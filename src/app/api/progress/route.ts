import { NextResponse } from 'next/server';

// GET /api/progress - Retrieve Jason's current progress
export async function GET() {
  try {
    // In a real application, you might want to include some basic authentication
    // or session validation here. For now, we'll return the progress data.

    // For this simple implementation, we'll simulate localStorage access
    // In production, you might want to use a proper database
    const mockProgress = {
      student_name: "Jason",
      created_date: new Date().toISOString(),
      last_session: new Date().toISOString(),
      vocabulary_mastered: ["assignment", "recess", "cafeteria"],
      vocabulary_in_progress: [
        {
          word: "original",
          definition: "first, not a copy",
          pronunciation_attempts: 2,
          pronunciation_clear: false,
          meaning_understood: true,
          used_in_sentence: false,
          last_practiced: new Date().toISOString(),
          difficulty_rating: 4
        }
      ],
      vocabulary_needs_review: [],
      pronunciation_sessions: [
        {
          date: new Date().toISOString(),
          duration_minutes: 3,
          sounds_practiced: ["R sounds", "TH sounds"],
          improvement_notes: "Tongue position improving",
          confidence_rating: 3
        }
      ],
      problem_sounds: ["R sounds", "TH sounds"],
      improved_sounds: ["L sounds"],
      total_sessions: 5,
      total_vocabulary_words: 8,
      confidence_score: 3.2,
      streak_days: 2,
      recent_words_practiced: ["original", "assignment", "recess"],
      recent_pronunciation_focus: ["R sounds", "TH sounds"]
    };

    return NextResponse.json({
      success: true,
      data: mockProgress
    });
  } catch (error) {
    console.error('Error retrieving progress:', error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to retrieve progress data",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// POST /api/progress - Update Jason's progress
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate the request body
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body"
        },
        { status: 400 }
      );
    }

    // Support different types of progress updates
    const { type, data } = body;

    switch (type) {
      case 'vocabulary':
        // Record vocabulary practice session
        const { word, definition, pronunciation_clear, meaning_understood, used_in_sentence } = data;

        if (!word || !definition) {
          return NextResponse.json(
            {
              success: false,
              error: "Word and definition are required for vocabulary updates"
            },
            { status: 400 }
          );
        }

        // In a real implementation, this would update the progress storage
        console.log('Vocabulary practice recorded:', {
          word,
          pronunciation_clear,
          meaning_understood,
          used_in_sentence
        });

        return NextResponse.json({
          success: true,
          message: "Vocabulary practice recorded successfully",
          data: {
            word,
            pronunciation_clear,
            meaning_understood,
            used_in_sentence,
            recorded_at: new Date().toISOString()
          }
        });

      case 'pronunciation':
        // Record pronunciation coaching session
        const { sounds_practiced, duration_minutes, improvement_notes, confidence_rating } = data;

        if (!sounds_practiced || !Array.isArray(sounds_practiced)) {
          return NextResponse.json(
            {
              success: false,
              error: "Sounds practiced array is required for pronunciation updates"
            },
            { status: 400 }
          );
        }

        // In a real implementation, this would update the progress storage
        console.log('Pronunciation session recorded:', {
          sounds_practiced,
          duration_minutes,
          confidence_rating
        });

        return NextResponse.json({
          success: true,
          message: "Pronunciation session recorded successfully",
          data: {
            sounds_practiced,
            duration_minutes,
            improvement_notes,
            confidence_rating,
            recorded_at: new Date().toISOString()
          }
        });

      case 'sound_improved':
        // Mark a sound as improved
        const { sound } = data;

        if (!sound) {
          return NextResponse.json(
            {
              success: false,
              error: "Sound is required for improvement updates"
            },
            { status: 400 }
          );
        }

        console.log('Sound marked as improved:', sound);

        return NextResponse.json({
          success: true,
          message: "Sound marked as improved successfully",
          data: {
            sound,
            marked_at: new Date().toISOString()
          }
        });

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid update type. Supported types: vocabulary, pronunciation, sound_improved"
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error updating progress:', error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update progress data",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// PUT /api/progress - Reset or backup progress
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'reset':
        // Reset all progress (use with caution)
        console.log('Progress reset requested');

        return NextResponse.json({
          success: true,
          message: "Progress has been reset successfully",
          data: {
            reset_at: new Date().toISOString()
          }
        });

      case 'backup':
        // Create backup of current progress
        if (!data) {
          return NextResponse.json(
            {
              success: false,
              error: "Progress data is required for backup"
            },
            { status: 400 }
          );
        }

        console.log('Progress backup created');

        return NextResponse.json({
          success: true,
          message: "Progress backup created successfully",
          data: {
            backup_created_at: new Date().toISOString(),
            data_size: JSON.stringify(data).length
          }
        });

      case 'import':
        // Import progress from backup
        if (!data) {
          return NextResponse.json(
            {
              success: false,
              error: "Progress data is required for import"
            },
            { status: 400 }
          );
        }

        console.log('Progress import completed');

        return NextResponse.json({
          success: true,
          message: "Progress imported successfully",
          data: {
            imported_at: new Date().toISOString(),
            vocabulary_mastered: data.vocabulary_mastered?.length || 0,
            pronunciation_sessions: data.pronunciation_sessions?.length || 0
          }
        });

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid action. Supported actions: reset, backup, import"
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in progress operation:', error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to perform progress operation",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}