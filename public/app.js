let currentSessionId = null;
let currentQuestion = null;

// Initialize the app
async function initializeApp() {
    try {
        const res = await fetch('/movies');
        const data = await res.json();
        displayMovies(data.movies);
    } catch (error) {
        console.error('Error loading movies:', error);
    }
}

// Display movie selection
function displayMovies(movies) {
    const movieList = document.getElementById('movieList');
    movieList.innerHTML = '';
    
    movies.forEach(movie => {
        const button = document.createElement('button');
        button.className = 'bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-4 px-6 rounded-lg transition transform hover:scale-105';
        button.textContent = movie;
        button.onclick = () => {
            // Disable all movie buttons to prevent multiple clicks
            const allButtons = movieList.querySelectorAll('button');
            allButtons.forEach(btn => btn.disabled = true);
            startQuiz(movie);
        };
        movieList.appendChild(button);
    });
}

// Start a quiz session
async function startQuiz(movieName) {
    try {
        const res = await fetch('/quiz/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ movieName })
        });
        
        const data = await res.json();
        
        currentSessionId = data.sessionId;
        currentQuestion = {
            question: data.question,
            options: data.options,
            questionNumber: data.questionNumber
        };
        
        // Show quiz screen
        document.getElementById('movieSelectScreen').classList.add('hidden');
        document.getElementById('quizScreen').classList.remove('hidden');
        document.getElementById('resultsScreen').classList.add('hidden');
        
        // Update header
        document.getElementById('movieTitle').textContent = `🎬 ${movieName}`;
        
        displayQuestion(data.question, data.options, data.questionNumber);
    } catch (error) {
        console.error('Error starting quiz:', error);
        alert('Failed to start quiz');
    }
}

// Display a question
function displayQuestion(question, options, questionNumber) {
    document.getElementById('questionText').textContent = question;
    document.getElementById('questionNumber').textContent = questionNumber;
    
    // Update progress bar
    const progress = (questionNumber / 5) * 100;
    document.getElementById('progressBar').style.width = progress + '%';
    
    // Display options
    const optionsContainer = document.getElementById('optionsContainer');
    optionsContainer.innerHTML = '';
    
    options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'w-full p-4 text-left bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition border border-gray-600 hover:border-yellow-600';
        button.innerHTML = `<span class="font-bold">${option.id}.</span> ${option.text}`;
        button.onclick = () => submitAnswer(option.id);
        optionsContainer.appendChild(button);
    });
    
    document.getElementById('loadingIndicator').classList.add('hidden');
}

// Submit an answer
async function submitAnswer(answer) {
    try {
        // Disable all buttons while processing
        const buttons = document.querySelectorAll('#optionsContainer button');
        buttons.forEach(btn => btn.disabled = true);
        
        const res = await fetch('/quiz/answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                sessionId: currentSessionId,
                answer: answer
            })
        });
        
        const data = await res.json();
        
        // Show feedback
        showAnswerFeedback(data, answer);
        
        // Update score
        document.getElementById('score').textContent = data.score;
        
        // Handle quiz completion
        if (data.quizFinished) {
            setTimeout(() => showResults(data.score), 2000);
        } else {
            // Show next question
            setTimeout(() => {
                displayQuestion(
                    data.nextQuestion.question,
                    data.nextQuestion.options,
                    data.nextQuestion.questionNumber
                );
                // Re-enable buttons for next question
                const newButtons = document.querySelectorAll('#optionsContainer button');
                newButtons.forEach(btn => btn.disabled = false);
            }, 2000);
        }
    } catch (error) {
        console.error('Error submitting answer:', error);
        alert('Failed to submit answer');
        // Re-enable buttons on error
        const buttons = document.querySelectorAll('#optionsContainer button');
        buttons.forEach(btn => btn.disabled = false);
    }
}

// Show answer feedback
function showAnswerFeedback(data, userAnswer) {
    const optionsContainer = document.getElementById('optionsContainer');
    const buttons = optionsContainer.querySelectorAll('button');
    
    buttons.forEach(btn => {
        const optionId = btn.textContent.split('.')[0].trim();
        
        if (optionId === data.correctAnswer) {
            btn.classList.add('bg-green-600', 'border-green-500');
            btn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
        } else if (optionId === userAnswer && !data.isCorrect) {
            btn.classList.add('bg-red-600', 'border-red-500');
            btn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
        }
        btn.disabled = true;
    });
    
    // Show explanation
    const explanationDiv = document.createElement('div');
    explanationDiv.className = `mt-4 p-4 rounded-lg ${data.isCorrect ? 'bg-green-900 border border-green-600' : 'bg-red-900 border border-red-600'}`;
    explanationDiv.innerHTML = `
        <p class="font-bold ${data.isCorrect ? 'text-green-300' : 'text-red-300'}">
            ${data.isCorrect ? '✓ Correct!' : '✗ Incorrect'}
        </p>
        <p class="text-gray-100 mt-2">${data.explanation}</p>
    `;
    optionsContainer.parentElement.insertBefore(explanationDiv, optionsContainer.nextSibling);
    
    // Remove loading indicator and show it after feedback
    document.getElementById('loadingIndicator').classList.remove('hidden');
}

// Show final results
function showResults(finalScore) {
    document.getElementById('quizScreen').classList.add('hidden');
    document.getElementById('resultsScreen').classList.remove('hidden');
    
    document.getElementById('finalScore').textContent = finalScore;
    
    let resultMessage = '';
    if (finalScore === 5) {
        resultMessage = '🏆 Perfect score! You are a true Bond expert!';
    } else if (finalScore >= 4) {
        resultMessage = '🥇 Excellent! You really know your Bond movies!';
    } else if (finalScore >= 3) {
        resultMessage = '🥈 Good job! You are a Bond fan!';
    } else if (finalScore >= 1) {
        resultMessage = '🥉 Not bad! Time to watch more Bond movies!';
    } else {
        resultMessage = '📺 You might want to rewatch some Bond films!';
    }
    
    document.getElementById('resultMessage').textContent = resultMessage;
}

// Reset and play again
document.getElementById('playAgainBtn').addEventListener('click', () => {
    currentSessionId = null;
    currentQuestion = null;
    document.getElementById('movieSelectScreen').classList.remove('hidden');
    document.getElementById('resultsScreen').classList.add('hidden');
    document.getElementById('score').textContent = '0';
});

// Start the app
initializeApp();