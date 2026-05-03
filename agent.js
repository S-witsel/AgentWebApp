import { AzureChatOpenAI } from "@langchain/openai"
import { createAgent } from "langchain";
import { retrieveMovieInfo, generateQuestion, evaluateAnswer } from "./tools.js";
import { MemorySaver } from "@langchain/langgraph";

const model = new AzureChatOpenAI({temperature: 0.7});

// Create memory checkpointer for persisting agent state
const memory = new MemorySaver();

// Define JSON schemas for structured responses
const questionResponseSchema = {
  type: "object",
  properties: {
    question: { type: "string", description: "The quiz question text" },
    options: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", enum: ["A", "B", "C", "D"] },
          text: { type: "string" }
        },
        required: ["id", "text"]
      },
      minItems: 4,
      maxItems: 4
    },
    correctAnswer: { type: "string", enum: ["A", "B", "C", "D"] },
    explanation: { type: "string", description: "Why this answer is correct" }
  },
  required: ["question", "options", "correctAnswer", "explanation"]
};

const evaluationResponseSchema = {
  type: "object",
  properties: {
    isCorrect: { type: "boolean" },
    scoreAdjustment: { type: "number", enum: [0, 1] },
    newScore: { type: "number", minimum: 0 },
    feedback: { type: "string", description: "Explanation of the answer" },
    explanation: { type: "string", description: "Why this answer is correct or incorrect" }
  },
  required: ["isCorrect", "scoreAdjustment", "newScore", "feedback", "explanation"]
};

// Agent for generating quiz questions using tools
const questionGeneratorAgent = createAgent({
    model,
    tools: [retrieveMovieInfo, generateQuestion],
    systemPrompt: `You are an expert James Bond quiz master. Your job is to:
1. Use the retrieveMovieInfo tool to search for information about specific aspects of the film (as instructed)
2. Use the generateQuestion tool to prepare the question based on that information
3. Create engaging multiple choice questions with exactly 4 answer options
4. Return the question and answers in JSON format

Important: Always search for the SPECIFIC topic you're asked to find. This ensures questions cover different parts of the film.
Vary your questions across different aspects: plot, characters, action, production, numbers, locations, gadgets, etc.

Return ONLY valid JSON that matches this schema (no other text):
${JSON.stringify(questionResponseSchema, null, 2)}`,
});

// Agent for evaluating answers and managing scores
const scoringAgent = createAgent({
    model,
    tools: [retrieveMovieInfo, evaluateAnswer],
    systemPrompt: `You are a James Bond quiz scoring expert. Your job is to:
1. Use the evaluateAnswer tool to check if a player's answer is correct
2. Calculate score adjustments based on correctness
3. Return the evaluation result with feedback

Use the retrieveMovieInfo tool if you need to verify information about an answer.

Return ONLY valid JSON that matches this schema (no other text):
${JSON.stringify(evaluationResponseSchema, null, 2)}`,
});

export async function callAgent(prompt) {
    try {
        const basicAgent = createAgent({
            model,
            tools: [retrieveMovieInfo],
            systemPrompt: "You are a helpful assistant about James Bond films. Use the retrieveMovieInfo tool to look up information from the film plot summaries.",
        });
        const result = await basicAgent.invoke({
            messages: [{ role: "user", content: prompt }],
        });
        return result;
    } catch (error) {
        console.error("Azure OpenAI error:", error);
        return "Sorry, the assistant is currently unavailable.";
    }
}

export async function generateQuizQuestion(movieName, questionNumber = 1, sessionId = null) {
    try {
        // Define different search topics based on question number for diversity
        const searchTopics = [
            "opening sequence and title credits",
            "main characters and cast",
            "action sequences and stunts",
            "plot twists and major events",
            "film duration and production details"
        ];
        
        const searchTopic = searchTopics[(questionNumber - 1) % searchTopics.length];
        
        const prompt = `Generate question ${questionNumber} about the James Bond film "${movieName}". 
Focus on the ${searchTopic} aspect of the film.

Steps:
1. Use the retrieveMovieInfo tool to search for information about "${searchTopic}" in "${movieName}"
2. Use the generateQuestion tool to create a question based on that specific information
3. Create a diverse, engaging multiple choice question with 4 options

Make sure the incorrect answers are plausible but clearly wrong when checked against the film information.
Return ONLY valid JSON with the question, options, correctAnswer, and explanation.`;
        
        // Create a unique config for this agent invocation with memory checkpointing
        const config = sessionId ? { configurable: { thread_id: `quiz-session-${sessionId}` } } : {};
        
        const result = await questionGeneratorAgent.invoke(
            {
                messages: [{ role: "user", content: prompt }],
            },
            config
        );
        
        const content = result.messages.at(-1).content;
        
        // Log for verification - show which tools were used
        console.log(`✅ Question generation tools invoked for question ${questionNumber} of "${movieName}"`);
        
        // Extract JSON from content (in case there's surrounding text)
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        
        return JSON.parse(content);
    } catch (error) {
        console.error("Error generating question:", error);
        throw new Error("Failed to generate quiz question");
    }
}

export async function checkAnswer(movieName, question, userAnswer, correctAnswer, currentScore, sessionId = null) {
    try {
        const prompt = `Evaluate this quiz answer:
Movie: ${movieName}
Question: ${question}
Player's answer: ${userAnswer}
Correct answer: ${correctAnswer}
Current score: ${currentScore}

Use the evaluateAnswer tool to check if this is correct and calculate the new score.
If needed, use retrieveMovieInfo to verify details about the film.`;
        
        // Create a unique config for this agent invocation with memory checkpointing
        const config = sessionId ? { configurable: { thread_id: `quiz-session-${sessionId}` } } : {};
        
        const result = await scoringAgent.invoke(
            {
                messages: [{ role: "user", content: prompt }],
            },
            config
        );
        
        const content = result.messages.at(-1).content;
        
        // Log for verification - show which tools were used
        console.log(`✅ Answer evaluation tools invoked for "${movieName}": User answer "${userAnswer}" vs Correct "${correctAnswer}"`);
        
        // Extract JSON from content
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        
        return JSON.parse(content);
    } catch (error) {
        console.error("Error checking answer:", error);
        throw new Error("Failed to check answer");
    }
}