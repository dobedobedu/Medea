"use client";
import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  LEARNING_PROGRESS_UPDATED_EVENT,
  loadLearningProgress,
} from "@/lib/jasonLearning";

// UI components
import Transcript from "./components/Transcript";
import Events from "./components/Events";
import BottomToolbar from "./components/BottomToolbar";

// Types
import { SessionStatus } from "@/app/types";
import type { RealtimeAgent } from '@openai/agents/realtime';

// Context providers & hooks
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useRealtimeSession } from "./hooks/useRealtimeSession";
import { createModerationGuardrail } from "@/app/agentConfigs/guardrails";

// Agent configs
import { allAgentSets, defaultAgentSetKey } from "@/app/agentConfigs";
import { chatSupervisorScenario } from "@/app/agentConfigs/chatSupervisor";
import { chatSupervisorCompanyName } from "@/app/agentConfigs/chatSupervisor";
import { learnScenario } from "@/app/agentConfigs/learn";
import { socialSkillsScenario } from "@/app/agentConfigs/socialSkills";
import { dailyReflectionScenario } from "@/app/agentConfigs/dailyReflection";

// Map used by connect logic for scenarios defined via the SDK.
const sdkScenarioMap: Record<string, RealtimeAgent[]> = {
  learn: learnScenario,
  chatSupervisor: chatSupervisorScenario,
  socialSkills: socialSkillsScenario,
  dailyReflection: dailyReflectionScenario,
};

import useAudioDownload from "./hooks/useAudioDownload";
import { useHandleSessionHistory } from "./hooks/useHandleSessionHistory";

function App() {
  const searchParams = useSearchParams()!;

  // ---------------------------------------------------------------------
  // Codec selector – lets you toggle between wide-band Opus (48 kHz)
  // and narrow-band PCMU/PCMA (8 kHz) to hear what the agent sounds like on
  // a traditional phone line and to validate ASR / VAD behaviour under that
  // constraint.
  //
  // We read the `?codec=` query-param and rely on the `changePeerConnection`
  // hook (configured in `useRealtimeSession`) to set the preferred codec
  // before the offer/answer negotiation.
  // ---------------------------------------------------------------------
  const urlCodec = searchParams.get("codec") || "opus";

  // Agents SDK doesn't currently support codec selection so it is now forced 
  // via global codecPatch at module load 

  const {
    addTranscriptMessage,
    addTranscriptBreadcrumb,
  } = useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();

  const [selectedAgentName, setSelectedAgentName] = useState<string>("");
  const [selectedAgentConfigSet, setSelectedAgentConfigSet] = useState<
    RealtimeAgent[] | null
  >(null);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  // Ref to identify whether the latest agent switch came from an automatic handoff
  const handoffTriggeredRef = useRef(false);

  const sdkAudioElement = React.useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const el = document.createElement('audio');
    el.autoplay = true;
    el.style.display = 'none';
    document.body.appendChild(el);
    return el;
  }, []);

  // Attach SDK audio element once it exists (after first render in browser)
  useEffect(() => {
    if (sdkAudioElement && !audioElementRef.current) {
      audioElementRef.current = sdkAudioElement;
    }
  }, [sdkAudioElement]);

  const {
    connect,
    disconnect,
    sendUserText,
    sendEvent,
    interrupt,
    mute,
  } = useRealtimeSession({
    onConnectionChange: (s) => setSessionStatus(s as SessionStatus),
    onAgentHandoff: (agentName: string) => {
      handoffTriggeredRef.current = true;
      setSelectedAgentName(agentName);
    },
  });

  const [sessionStatus, setSessionStatus] =
    useState<SessionStatus>("DISCONNECTED");

  const [isEventsPaneExpanded, setIsEventsPaneExpanded] =
    useState<boolean>(false); // Hide by default now
  const [userText, setUserText] = useState<string>("");
  const [isPTTActive, setIsPTTActive] = useState<boolean>(false);
  const [isPTTUserSpeaking, setIsPTTUserSpeaking] = useState<boolean>(false);
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] = useState<boolean>(
    () => {
      if (typeof window === 'undefined') return true;
      const stored = localStorage.getItem('audioPlaybackEnabled');
      return stored ? stored === 'true' : true;
    },
  );

  // Tab state for three-tab navigation
  const [activeTab, setActiveTab] = useState<string>(() => {
    const agentConfig = searchParams.get("agentConfig") || "dailyReflection";
    // Map agent configs to tab names
    const tabMap: Record<string, string> = {
      "learn": "learn",
      "socialSkills": "socialSkills",
      "dailyReflection": "dailyJournal",
      "chatSupervisor": "dailyJournal"
    };
    return tabMap[agentConfig] || "dailyJournal";
  });

  // Initialize the recording hook.
  const { startRecording, stopRecording, downloadRecording } =
    useAudioDownload();

  const [learningCounts, setLearningCounts] = useState<{
    vocab: number;
    holiday_words: number;
    holiday_greetings: number;
    lastWord?: string;
  }>({ vocab: 0, holiday_words: 0, holiday_greetings: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const refresh = () => {
      const progress = loadLearningProgress();
      const last = progress.updates[progress.updates.length - 1];
      setLearningCounts({
        vocab: progress.masteredByTrack.vocab.length,
        holiday_words: progress.masteredByTrack.holiday_words.length,
        holiday_greetings: progress.masteredByTrack.holiday_greetings.length,
        lastWord: last?.word,
      });
    };

    refresh();
    window.addEventListener(LEARNING_PROGRESS_UPDATED_EVENT, refresh as any);
    return () =>
      window.removeEventListener(
        LEARNING_PROGRESS_UPDATED_EVENT,
        refresh as any,
      );
  }, []);

  const sendClientEvent = (eventObj: any, eventNameSuffix = "") => {
    try {
      sendEvent(eventObj);
      logClientEvent(eventObj, eventNameSuffix);
    } catch (err) {
      console.error('Failed to send via SDK', err);
    }
  };

  useHandleSessionHistory();

  useEffect(() => {
    let finalAgentConfig = searchParams.get("agentConfig");
    if (!finalAgentConfig || !allAgentSets[finalAgentConfig]) {
      finalAgentConfig = defaultAgentSetKey;
      const url = new URL(window.location.toString());
      url.searchParams.set("agentConfig", finalAgentConfig);
      window.location.replace(url.toString());
      return;
    }

    const agents = allAgentSets[finalAgentConfig];
    const storedPreferred = localStorage.getItem(
      `preferredAgent:${finalAgentConfig}`,
    );
    const agentKeyToUse =
      (storedPreferred && agents.some((a) => a.name === storedPreferred)
        ? storedPreferred
        : agents[0]?.name) || "";

    setSelectedAgentName(agentKeyToUse);
    setSelectedAgentConfigSet(agents);
  }, [searchParams]);

  useEffect(() => {
    if (selectedAgentName && sessionStatus === "DISCONNECTED") {
      connectToRealtime();
    }
  }, [selectedAgentName]);

  useEffect(() => {
    if (
      sessionStatus === "CONNECTED" &&
      selectedAgentConfigSet &&
      selectedAgentName
    ) {
      const currentAgent = selectedAgentConfigSet.find(
        (a) => a.name === selectedAgentName
      );
      addTranscriptBreadcrumb(`Agent: ${selectedAgentName}`, currentAgent);
      updateSession(!handoffTriggeredRef.current);
      // Reset flag after handling so subsequent effects behave normally
      handoffTriggeredRef.current = false;
    }
  }, [selectedAgentConfigSet, selectedAgentName, sessionStatus]);

  useEffect(() => {
    if (sessionStatus === "CONNECTED") {
      updateSession();
    }
  }, [isPTTActive]);

  const fetchEphemeralKey = async (): Promise<string | null> => {
    logClientEvent({ url: "/session" }, "fetch_session_token_request");
    const tokenResponse = await fetch("/api/session");
    const data = await tokenResponse.json();
    logServerEvent(data, "fetch_session_token_response");

    if (!data.client_secret?.value) {
      logClientEvent(data, "error.no_ephemeral_key");
      console.error("No ephemeral key provided by the server");
      setSessionStatus("DISCONNECTED");
      return null;
    }

    return data.client_secret.value;
  };

  const connectToRealtime = async () => {
    const agentSetKey = searchParams.get("agentConfig") || "default";
    if (sdkScenarioMap[agentSetKey]) {
      if (sessionStatus !== "DISCONNECTED") return;
      setSessionStatus("CONNECTING");

      try {
        const EPHEMERAL_KEY = await fetchEphemeralKey();
        if (!EPHEMERAL_KEY) return;

        // Ensure the selectedAgentName is first so that it becomes the root
        const reorderedAgents = [...sdkScenarioMap[agentSetKey]];
        const idx = reorderedAgents.findIndex((a) => a.name === selectedAgentName);
        if (idx > 0) {
          const [agent] = reorderedAgents.splice(idx, 1);
          reorderedAgents.unshift(agent);
        }

        const companyName = chatSupervisorCompanyName;
        const guardrail = createModerationGuardrail(companyName);

        await connect({
          getEphemeralKey: async () => EPHEMERAL_KEY,
          initialAgents: reorderedAgents,
          audioElement: sdkAudioElement,
          outputGuardrails: [guardrail],
          extraContext: {
            addTranscriptBreadcrumb,
          },
        });
      } catch (err) {
        console.error("Error connecting via SDK:", err);
        setSessionStatus("DISCONNECTED");
      }
      return;
    }
  };

  const disconnectFromRealtime = () => {
    disconnect();
    setSessionStatus("DISCONNECTED");
    setIsPTTUserSpeaking(false);
  };

  const sendSimulatedUserMessage = (text: string) => {
    const id = uuidv4().slice(0, 32);
    addTranscriptMessage(id, "user", text, true);

    sendClientEvent({
      type: 'conversation.item.create',
      item: {
        id,
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    });
    sendClientEvent({ type: 'response.create' }, '(simulated user text message)');
  };

  const updateSession = (shouldTriggerResponse: boolean = false) => {
    // Reflect Push-to-Talk UI state by (de)activating server VAD on the
    // backend. The Realtime SDK supports live session updates via the
    // `session.update` event.
    const turnDetection = isPTTActive
      ? null
      : {
          type: 'server_vad',
          threshold: 0.9,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
          create_response: true,
        };

    sendEvent({
      type: 'session.update',
      session: {
        turn_detection: turnDetection,
      },
    });

    // Send an initial 'hi' message to trigger the agent to greet the user
    if (shouldTriggerResponse) {
      sendSimulatedUserMessage('hi');
    }
    return;
  }

  const handleSendTextMessage = () => {
    if (!userText.trim()) return;
    interrupt();

    try {
      sendUserText(userText.trim());
    } catch (err) {
      console.error('Failed to send via SDK', err);
    }

    setUserText("");
  };

  const handleTalkButtonDown = () => {
    if (sessionStatus !== 'CONNECTED') return;
    interrupt();

    setIsPTTUserSpeaking(true);
    sendClientEvent({ type: 'input_audio_buffer.clear' }, 'clear PTT buffer');

    // No placeholder; we'll rely on server transcript once ready.
  };

  const handleTalkButtonUp = () => {
    if (sessionStatus !== 'CONNECTED' || !isPTTUserSpeaking)
      return;

    setIsPTTUserSpeaking(false);
    sendClientEvent({ type: 'input_audio_buffer.commit' }, 'commit PTT');
    sendClientEvent({ type: 'response.create' }, 'trigger response PTT');
  };

  const onToggleConnection = () => {
    if (sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING") {
      disconnectFromRealtime();
      setSessionStatus("DISCONNECTED");
    } else {
      connectToRealtime();
    }
  };

  // Individual handlers for BottomToolbar compatibility
  const onConnect = () => {
    if (sessionStatus !== "CONNECTED" && sessionStatus !== "CONNECTING") {
      connectToRealtime();
    }
  };

  const onDisconnect = () => {
    if (sessionStatus === "CONNECTED") {
      disconnectFromRealtime();
      setSessionStatus("DISCONNECTED");
    }
  };

  const onPause = () => {
    // Pause functionality not implemented, using disconnect for now
    onDisconnect();
  };

  
  const handleSelectedAgentChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newAgentName = e.target.value;
    const agentSetKey = searchParams.get("agentConfig") || "default";
    localStorage.setItem(`preferredAgent:${agentSetKey}`, newAgentName);
    // Reconnect session with the newly selected agent as root so that tool
    // execution works correctly.
    disconnectFromRealtime();
    setSelectedAgentName(newAgentName);
    // connectToRealtime will be triggered by effect watching selectedAgentName
  };

  // Because we need a new connection, refresh the page when codec changes
  const handleCodecChange = (newCodec: string) => {
    const url = new URL(window.location.toString());
    url.searchParams.set("codec", newCodec);
    window.location.replace(url.toString());
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);

    // Map tab names to agent configs
    const agentConfigMap: Record<string, string> = {
      "learn": "learn",
      "socialSkills": "socialSkills",
      "dailyJournal": "dailyReflection" // Use chatSupervisor as placeholder until ready
    };

    const agentConfig = agentConfigMap[tab] || "dailyReflection";
    const url = new URL(window.location.toString());
    url.searchParams.set("agentConfig", agentConfig);
    window.location.replace(url.toString());
  };

  const toggleLogs = () => {
    setIsEventsPaneExpanded(!isEventsPaneExpanded);
  };

  useEffect(() => {
    const storedPushToTalkUI = localStorage.getItem("pushToTalkUI");
    if (storedPushToTalkUI) {
      setIsPTTActive(storedPushToTalkUI === "true");
    }
    const storedLogsExpanded = localStorage.getItem("logsExpanded");
    if (storedLogsExpanded) {
      setIsEventsPaneExpanded(storedLogsExpanded === "true");
    }
    const storedAudioPlaybackEnabled = localStorage.getItem(
      "audioPlaybackEnabled"
    );
    if (storedAudioPlaybackEnabled) {
      setIsAudioPlaybackEnabled(storedAudioPlaybackEnabled === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("pushToTalkUI", isPTTActive.toString());
  }, [isPTTActive]);

  useEffect(() => {
    localStorage.setItem("logsExpanded", isEventsPaneExpanded.toString());
  }, [isEventsPaneExpanded]);

  useEffect(() => {
    localStorage.setItem(
      "audioPlaybackEnabled",
      isAudioPlaybackEnabled.toString()
    );
  }, [isAudioPlaybackEnabled]);

  useEffect(() => {
    if (audioElementRef.current) {
      if (isAudioPlaybackEnabled) {
        audioElementRef.current.muted = false;
        audioElementRef.current.play().catch((err) => {
          console.warn("Autoplay may be blocked by browser:", err);
        });
      } else {
        // Mute and pause to avoid brief audio blips before pause takes effect.
        audioElementRef.current.muted = true;
        audioElementRef.current.pause();
      }
    }

    // Toggle server-side audio stream mute so bandwidth is saved when the
    // user disables playback. 
    try {
      mute(!isAudioPlaybackEnabled);
    } catch (err) {
      console.warn('Failed to toggle SDK mute', err);
    }
  }, [isAudioPlaybackEnabled]);

  // Ensure mute state is propagated to transport right after we connect or
  // whenever the SDK client reference becomes available.
  useEffect(() => {
    if (sessionStatus === 'CONNECTED') {
      try {
        mute(!isAudioPlaybackEnabled);
      } catch (err) {
        console.warn('mute sync after connect failed', err);
      }
    }
  }, [sessionStatus, isAudioPlaybackEnabled]);

  useEffect(() => {
    if (sessionStatus === "CONNECTED" && audioElementRef.current?.srcObject) {
      // The remote audio stream from the audio element.
      const remoteStream = audioElementRef.current.srcObject as MediaStream;
      startRecording(remoteStream);
    }

    // Clean up on unmount or when sessionStatus is updated.
    return () => {
      stopRecording();
    };
  }, [sessionStatus]);

  return (
    <div className="text-base flex flex-col h-screen bg-background text-foreground relative">
      {/* Three-Tab Top Bar */}
      <div className="bg-background border-b border-border px-4 py-3">
        <div className="flex justify-center gap-2">
          <Button
            onClick={() => handleTabChange("learn")}
            variant={activeTab === "learn" ? "default" : "secondary"}
            className="px-6 text-base touch-manipulation"
          >
            Learn
          </Button>
          <Button
            onClick={() => handleTabChange("socialSkills")}
            variant={activeTab === "socialSkills" ? "default" : "secondary"}
            className="px-6 text-base touch-manipulation"
          >
            Interact
          </Button>
          <Button
            onClick={() => handleTabChange("dailyJournal")}
            variant={activeTab === "dailyJournal" ? "default" : "secondary"}
            className="px-6 text-base touch-manipulation"
          >
            Reflect
          </Button>
        </div>
      </div>

      {/* Two-Column Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column - Agent Panel (30% width on desktop) */}
        <div className="hidden md:flex md:flex-col md:w-1/3 lg:w-[30%] bg-background border-r border-border">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold">
              {activeTab === "learn" && "Learn"}
              {activeTab === "socialSkills" && "Interact"}
              {activeTab === "dailyJournal" && "Reflect"}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {selectedAgentConfigSet && (
              <div className="space-y-2">
                {activeTab === "learn" && (
                  <Card className="p-3">
                    <div className="text-sm font-semibold">Learning</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Vocab mastered: {learningCounts.vocab} · Holiday words:{" "}
                      {learningCounts.holiday_words} · Holiday greetings:{" "}
                      {learningCounts.holiday_greetings}
                      {learningCounts.lastWord
                        ? ` · Last: ${learningCounts.lastWord}`
                        : ""}
                    </div>
                  </Card>
                )}
                {selectedAgentConfigSet.map((agent) => (
                  <Card
                    key={agent.name}
                    className={`p-3 cursor-pointer transition-colors ${
                      selectedAgentName === agent.name
                        ? "border-primary bg-accent"
                        : "hover:bg-accent"
                    }`}
                    onClick={() => handleSelectedAgentChange({ target: { value: agent.name } } as any)}
                  >
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {agent.name === selectedAgentName ? "Active" : "Tap to select"}
                    </div>
                  </Card>
                ))}

                <button className="w-full p-3 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:bg-accent transition-colors">
                  + Add Agent
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Agent Panel (Accordion on ≤768px) */}
        <div className="md:hidden w-full">
          <div className="bg-background border-b border-border">
            <div className="p-4">
              <h2 className="text-lg font-semibold mb-3">
                {activeTab === "learn" && "Learn"}
                {activeTab === "socialSkills" && "Interact"}
                {activeTab === "dailyJournal" && "Reflect"}
              </h2>

              {selectedAgentConfigSet && (
                <div className="space-y-2">
                  {activeTab === "learn" && (
                    <Card className="p-3">
                      <div className="text-sm font-semibold">Learning</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Vocab mastered: {learningCounts.vocab} · Holiday words:{" "}
                        {learningCounts.holiday_words} · Holiday greetings:{" "}
                        {learningCounts.holiday_greetings}
                        {learningCounts.lastWord
                          ? ` · Last: ${learningCounts.lastWord}`
                          : ""}
                      </div>
                    </Card>
                  )}
                  {selectedAgentConfigSet.map((agent) => (
                    <Card
                      key={agent.name}
                      className={`p-3 cursor-pointer transition-colors ${
                        selectedAgentName === agent.name
                          ? "border-primary bg-accent"
                          : "hover:bg-accent"
                      }`}
                      onClick={() => handleSelectedAgentChange({ target: { value: agent.name } } as any)}
                    >
                      <div className="font-medium">{agent.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {agent.name === selectedAgentName ? "Active" : "Tap to select"}
                      </div>
                    </Card>
                  ))}

                  <button className="w-full p-3 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:bg-accent transition-colors">
                    + Add Agent
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Transcript Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-3 bg-background border-b border-border">
            <div className="text-sm font-medium text-muted-foreground">
              {selectedAgentName && (
                <span>
                  Active Agent:{" "}
                  <span className="text-primary">{selectedAgentName}</span>
                </span>
              )}
              {sessionStatus && (
                <span className="ml-3">({sessionStatus})</span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <Transcript
              userText={userText}
              setUserText={setUserText}
              onSendMessage={handleSendTextMessage}
              downloadRecording={downloadRecording}
              canSend={sessionStatus === "CONNECTED"}
            />
          </div>
        </div>
      </div>

      {/* Footer with Control Buttons */}
      <div className="bg-background border-t border-border px-4 py-3">
        <div className="flex justify-between items-center">
          <Button
            onClick={toggleLogs}
            variant="secondary"
            className="touch-manipulation"
          >
            {isEventsPaneExpanded ? "Hide Logs △" : "Logs ▽"}
          </Button>

          {/* Connection Control Buttons */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              {/* Connect/End Conditional Button */}
              <Button
                onClick={onToggleConnection}
                disabled={sessionStatus === 'CONNECTING'}
                variant={sessionStatus === "CONNECTED" ? "destructive" : "default"}
                className="touch-manipulation"
              >
                {sessionStatus === 'CONNECTED' ? "End" : sessionStatus === 'CONNECTING' ? "Connecting..." : "Connect"}
              </Button>

              {/* Push-to-Talk Button */}
              <Button
                onMouseDown={handleTalkButtonDown}
                onMouseUp={handleTalkButtonUp}
                onTouchStart={handleTalkButtonDown}
                onTouchEnd={handleTalkButtonUp}
                disabled={!isPTTActive || sessionStatus !== 'CONNECTED'}
                variant={isPTTUserSpeaking ? "secondary" : "outline"}
                className="touch-manipulation"
              >
                {isPTTUserSpeaking ? "Speaking..." : "Push to Talk"}
              </Button>
            </div>

            {/* Push-to-Talk Toggle */}
            <div className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                id="ptt-toggle-main"
                checked={isPTTActive}
                onChange={(e) => setIsPTTActive(e.target.checked)}
                disabled={sessionStatus !== 'CONNECTED'}
                className="w-4 h-4"
              />
              <label
                htmlFor="ptt-toggle-main"
                className={`cursor-pointer ${sessionStatus !== 'CONNECTED' ? 'text-muted-foreground' : ''}`}
              >
                Enable Push-to-Talk (hold button to speak)
              </label>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            {sessionStatus}
          </div>
        </div>
      </div>

      {/* Slide-up Logs Overlay */}
      {isEventsPaneExpanded && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={toggleLogs} />
          <div className="relative w-full h-3/4 bg-background rounded-t-xl shadow-xl flex flex-col">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h3 className="text-lg font-semibold">Logs</h3>
              <Button
                onClick={toggleLogs}
                variant="secondary"
                size="sm"
              >
                Hide Logs △
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="h-full w-full">
                <Events isExpanded={true} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keep BottomToolbar for connection controls but hide it visually */}
      <div className="hidden">
        <BottomToolbar
          sessionStatus={sessionStatus}
          onToggleConnection={onToggleConnection}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onPause={onPause}
          isPTTActive={isPTTActive}
          setIsPTTActive={setIsPTTActive}
          isPTTUserSpeaking={isPTTUserSpeaking}
          handleTalkButtonDown={handleTalkButtonDown}
          handleTalkButtonUp={handleTalkButtonUp}
          isEventsPaneExpanded={isEventsPaneExpanded}
          setIsEventsPaneExpanded={setIsEventsPaneExpanded}
          isAudioPlaybackEnabled={isAudioPlaybackEnabled}
          setIsAudioPlaybackEnabled={setIsAudioPlaybackEnabled}
          codec={urlCodec}
          onCodecChange={handleCodecChange}
        />
      </div>
    </div>
  );
}

export default App;
