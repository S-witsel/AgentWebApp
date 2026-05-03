import { AzureOpenAIEmbeddings } from "@langchain/openai";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { tool } from "@langchain/core/tools";

const embeddings = new AzureOpenAIEmbeddings({
    temperature: 0,
    azureOpenAIApiEmbeddingsDeploymentName: process.env.AZURE_EMBEDDING_DEPLOYMENT_NAME
});

const vectorStore = await FaissStore.load("./documents", embeddings);
console.log("✅ vector store loaded!")

export const retrieveMovieInfo = tool(
  async ({ movieName, topic }) => {
    console.log(`🔍 Retrieving ${topic} information about ${movieName}`)
    const searchPrompt = `${movieName} ${topic}`;
    const relevantDocs = await vectorStore.similaritySearch(searchPrompt, 5)
    
    // Extract document source metadata
    const documentSources = relevantDocs.map((doc, idx) => {
      const metadata = doc.metadata || {};
      const filename = metadata.source || 'unknown source';
      const movieSource = filename.split('/').pop()?.replace('.txt', '') || 'unknown';
      return `[Doc ${idx + 1}: ${movieSource}]`;
    }).join(', ');
    
    const context = relevantDocs.map(doc => doc.pageContent).join("\n\n")
    
    // Log which documents were retrieved for verification
    console.log(`📚 Retrieved from: ${documentSources}`)
    
    const result = context || `No information found about ${topic} in ${movieName}`;
    
    // Return with source metadata
    return result + `\n\n[Retrieved from: ${documentSources}]`;
  },
  {
    name: "retrieveMovieInfo",
    description: "Search and retrieve specific information about a James Bond film from the plot summaries. Use this to find plot details, character info, numbers, or production details. Searches different parts of the film to ensure diverse question generation.",
    schema: {
        "type": "object",
        "properties": { 
          "movieName": { "type": "string", "description": "The name of the James Bond film" },
          "topic": { "type": "string", "description": "What information to search for (e.g., 'opening sequence', 'characters', 'action scenes', 'plot twists', 'production details', 'deaths', 'gadgets', 'locations')" }
        },
        "required": ["movieName", "topic"]
    }
  }
)

export const generateQuestion = tool(
  async ({ movieName, movieInfo, questionNumber }) => {
    console.log(`❓ Generating question #${questionNumber} for ${movieName}`)
    
    const questionTypes = [
      "plot event",
      "character detail",
      "specific number or statistic",
      "production detail",
      "action scene",
      "dialogue or quote"
    ];
    
    const questionType = questionTypes[questionNumber % questionTypes.length];
    
    return JSON.stringify({
      movieName,
      movieInfo,
      questionNumber,
      suggestedType: questionType,
      instruction: `Generate a ${questionType} question based on the movie information provided. Return a JSON object with: question, options (array with id and text), correctAnswer (A/B/C/D), and explanation.`
    });
  },
  {
    name: "generateQuestion",
    description: "Prepare to generate a quiz question based on retrieved movie information. Returns a formatted request for question generation.",
    schema: {
        "type": "object",
        "properties": { 
          "movieName": { "type": "string", "description": "The name of the James Bond film" },
          "movieInfo": { "type": "string", "description": "The movie information to base the question on" },
          "questionNumber": { "type": "number", "description": "Which question number this is (1-5)" }
        },
        "required": ["movieName", "movieInfo", "questionNumber"]
    }
  }
)


export const evaluateAnswer = tool(
  async ({ movieName, question, userAnswer, correctAnswer, currentScore }) => {
    console.log(`✅ Evaluating answer: ${userAnswer} (correct: ${correctAnswer})`)
    
    const isCorrect = userAnswer === correctAnswer;
    const scoreAdjustment = isCorrect ? 1 : 0;
    const newScore = currentScore + scoreAdjustment;
    
    const feedback = isCorrect 
      ? "Correct! Well done!"
      : `Incorrect. The correct answer was ${correctAnswer}.`;
    
    return JSON.stringify({
      isCorrect,
      scoreAdjustment,
      newScore,
      feedback,
      movieName,
      question
    });
  },
  {
    name: "evaluateAnswer",
    description: "Evaluate if a player's answer is correct and calculate the new score. Returns evaluation result and score adjustment.",
    schema: {
        "type": "object",
        "properties": { 
          "movieName": { "type": "string", "description": "The name of the James Bond film" },
          "question": { "type": "string", "description": "The quiz question that was asked" },
          "userAnswer": { "type": "string", "description": "The player's answer (A/B/C/D)" },
          "correctAnswer": { "type": "string", "description": "The correct answer (A/B/C/D)" },
          "currentScore": { "type": "number", "description": "The player's current score before this question" }
        },
        "required": ["movieName", "question", "userAnswer", "correctAnswer", "currentScore"]
    }
  }
)