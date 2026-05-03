import express from 'express';
import { callAgent, generateQuizQuestion, checkAnswer } from './agent.js';

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));

// Store active quiz sessions
const quizSessions = new Map();

const MOVIES = [
    "Casino Royale",
    "Quantum of Solace",
    "Skyfall",
    "Spectre",
    "Die Another Day",
    "No Time to Die"
];

// Get list of available movies
app.get('/movies', (req, res) => {
    res.json({ movies: MOVIES });
});

// Start a new quiz session
app.post('/quiz/start', async (req, res) => {
    const { movieName } = req.body;
    
    if (!movieName || !MOVIES.includes(movieName)) {
        return res.status(400).json({ error: 'Invalid movie name' });
    }
    
    try {
        const sessionId = Math.random().toString(36).substring(7);
        console.log(`\n📋 [${sessionId}] Starting new quiz session for "${movieName}"`);
        
        const question = await generateQuizQuestion(movieName, 1, sessionId);
        
        // Store session
        quizSessions.set(sessionId, {
            movieName,
            score: 0,
            questionCount: 0,
            currentQuestion: question
        });
        
        console.log(`✅ [${sessionId}] First question generated successfully`);
        
        res.json({ 
            sessionId,
            movieName,
            question: question.question,
            options: question.options,
            score: 0,
            questionNumber: 1
        });
    } catch (error) {
        console.error('❌ Error starting quiz:', error);
        res.status(500).json({ error: 'Failed to start quiz' });
    }
});

// Submit an answer
app.post('/quiz/answer', async (req, res) => {
    const { sessionId, answer } = req.body;
    
    if (!sessionId || !quizSessions.has(sessionId)) {
        return res.status(400).json({ error: 'Invalid session' });
    }
    
    try {
        const session = quizSessions.get(sessionId);
        const { movieName, currentQuestion } = session;
        
        console.log(`\n📝 [${sessionId}] Processing answer for question ${session.questionCount + 1}`);
        console.log(`   Movie: "${movieName}"`);
        console.log(`   User chose: ${answer} | Correct answer: ${currentQuestion.correctAnswer}`);
        
        // Check if answer is correct using the agent with session memory
        console.log(`   🤖 Invoking scoring agent with evaluateAnswer tool...`);
        const evaluationResult = await checkAnswer(
            movieName, 
            currentQuestion.question, 
            answer,
            currentQuestion.correctAnswer,
            session.score,
            sessionId
        );
        
        // Update score based on agent evaluation
        const isCorrect = answer === currentQuestion.correctAnswer;
        if (isCorrect) {
            session.score++;
            console.log(`   ✅ Correct! Score increased to: ${session.score}`);
        } else {
            console.log(`   ❌ Incorrect. Score remains: ${session.score}`);
        }
        
        session.questionCount++;
        
        // Generate next question (up to 5 questions per quiz)
        let nextQuestion = null;
        let quizFinished = false;
        
        if (session.questionCount < 5) {
            console.log(`   🤖 Invoking question generator agent for question ${session.questionCount + 1}...`);
            nextQuestion = await generateQuizQuestion(movieName, session.questionCount + 1, sessionId);
            session.currentQuestion = nextQuestion;
            console.log(`   ✅ Next question generated successfully`);
        } else {
            quizFinished = true;
            console.log(`   🏁 Quiz finished! Final score: ${session.score}/5`);
        }
        
        res.json({
            isCorrect,
            correctAnswer: currentQuestion.correctAnswer,
            explanation: currentQuestion.explanation,
            score: session.score,
            questionCount: session.questionCount,
            quizFinished,
            nextQuestion: nextQuestion ? {
                question: nextQuestion.question,
                options: nextQuestion.options,
                questionNumber: session.questionCount + 1
            } : null
        });
    } catch (error) {
        console.error(`❌ [${sessionId}] Error checking answer:`, error);
        res.status(500).json({ error: 'Failed to process answer' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});