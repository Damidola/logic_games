document.addEventListener('DOMContentLoaded', () => {
    // Connect Four game class
    class ConnectFourGame {
        constructor() {
            // Constants
            this.ROWS = 6;
            this.COLS = 7;
            this.EMPTY = 0;
            this.PLAYER = 1;
            this.AI = 2;
            this.CONNECT = 4;
            this.DIFFICULTY_LEVELS = ['Easy', 'Medium', 'Hard'];
            
            // Game state
            this.board = this.createEmptyBoard();
            this.gameOver = false;
            this.currentDifficulty = 1; // 1-Easy, 2-Medium, 3-Hard
            this.moveHistory = [];
            this.winningCells = [];
            this.playerTurn = true; // Flag to track if it's player's turn
            this.isProcessingMove = false; // Flag to prevent rapid clicks
            
            // Initialize theme
            this.initializeTheme();
            
            // DOM elements
            this.cacheDOMElements();
            
            // Initialize board
            this.initializeBoard();
            
            // Event listeners
            this.setupEventListeners();
        }
        
        // Create empty board
        createEmptyBoard() {
            return Array(this.ROWS).fill().map(() => Array(this.COLS).fill(this.EMPTY));
        }
        
        // Initialize theme
        initializeTheme() {
            // Set dark theme as default
            document.body.classList.add('dark-theme');
            
            // Load saved theme if available
            if (localStorage.getItem('theme') === 'light') {
                document.body.classList.remove('dark-theme');
            }
        }
        
        // Cache DOM elements for better performance
        cacheDOMElements() {
            this.boardElement = document.getElementById('board');
            this.gameOverElement = document.getElementById('game-over');
            this.playAgainButton = document.getElementById('play-again');
            this.newGameButton = document.getElementById('new-game');
            this.winnerMessage = document.getElementById('winner-message');
            this.difficultyButton = document.getElementById('difficulty-button');
            this.undoButton = document.getElementById('undo-button');
            this.menuDots = this.difficultyButton.querySelectorAll('.menu-dot');
            this.themeToggle = document.getElementById('theme-toggle');
        }
        
        // Initialize game board
        initializeBoard() {
            this.boardElement.innerHTML = '';
            this.boardElement.classList.remove('ai-turn'); // Ensure clean state
            
            for (let col = 0; col < this.COLS; col++) {
                const column = document.createElement('div');
                column.classList.add('column');
                column.dataset.col = col;
                
                for (let row = 0; row < this.ROWS; row++) {
                    const cell = document.createElement('div');
                    cell.classList.add('cell');
                    cell.dataset.row = row;
                    cell.dataset.col = col;
                    column.appendChild(cell);
                }
                
                column.addEventListener('click', () => {
                    // Stricter check: Game not over, it's player's turn, and no move is currently processing
                    if (!this.gameOver && this.playerTurn && !this.isProcessingMove) {
                        const col = parseInt(column.dataset.col);
                        this.makeMove(col);
                    }
                });
                
                this.boardElement.appendChild(column);
            }
            
            // Update difficulty dots
            this.updateDifficultyDots();
        }
        
        // Setup event listeners
        setupEventListeners() {
            this.newGameButton.addEventListener('click', () => this.resetGame());
            this.playAgainButton.addEventListener('click', () => this.resetGame());
            this.undoButton.addEventListener('click', () => this.undoMove());
            
            // Difficulty button
            this.difficultyButton.addEventListener('click', () => {
                this.currentDifficulty = (this.currentDifficulty % 3) + 1;
                this.updateDifficultyDots();
            });
            
            // Theme toggle
            if (this.themeToggle) {
                this.themeToggle.addEventListener('click', () => {
                    document.body.classList.toggle('dark-theme');
                    localStorage.setItem('theme', 
                        document.body.classList.contains('dark-theme') ? 'dark' : 'light');
                });
            }
        }
        
        // Update difficulty indicator dots
        updateDifficultyDots() {
            this.menuDots.forEach((dot, index) => {
                dot.classList.toggle('active', index < this.currentDifficulty);
            });
        }
        
        // Update board display
        updateBoard() {
            for (let row = 0; row < this.ROWS; row++) {
                for (let col = 0; col < this.COLS; col++) {
                    const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
                    
                    // Remove all player classes
                    cell.classList.remove('player', 'ai');
                    
                    // Add appropriate class
                    if (this.board[row][col] === this.PLAYER) {
                        cell.classList.add('player');
                    } else if (this.board[row][col] === this.AI) {
                        cell.classList.add('ai');
                    }
                }
            }
        }
        
        // Reset game
        resetGame() {
            this.board = this.createEmptyBoard();
            this.gameOver = false;
            this.moveHistory = [];
            this.playerTurn = true; // Reset to player's turn
            this.gameOverElement.classList.remove('active');
            this.updateBoard();
        }
        
        // Check for win
        checkWin(row, col, player) {
            // Directions: horizontal, vertical, diagonal down-right, diagonal up-right
            const directions = [
                [0, 1],  // horizontal
                [1, 0],  // vertical
                [1, 1],  // diagonal down-right
                [-1, 1]  // diagonal up-right
            ];
            
            for (const [dx, dy] of directions) {
                let count = 1;  // Count current cell
                
                // Check forward direction
                for (let i = 1; i < this.CONNECT; i++) {
                    const r = row + i * dx;
                    const c = col + i * dy;
                    
                    if (this.isValidCell(r, c) && this.board[r][c] === player) {
                        count++;
                    } else {
                        break;
                    }
                }
                
                // Check backward direction
                for (let i = 1; i < this.CONNECT; i++) {
                    const r = row - i * dx;
                    const c = col - i * dy;
                    
                    if (this.isValidCell(r, c) && this.board[r][c] === player) {
                        count++;
                    } else {
                        break;
                    }
                }
                
                // If found 4 in a row, return true
                if (count >= this.CONNECT) {
                    return true;
                }
            }
            
            return false;
        }
        
        // Check if cell coordinates are valid
        isValidCell(row, col) {
            return row >= 0 && row < this.ROWS && col >= 0 && col < this.COLS;
        }
        
        // Check if move is valid
        isValidMove(col) {
            return this.board[this.ROWS - 1][col] === this.EMPTY;
        }
        
        // Get first empty row in column
        getFirstEmptyRow(col) {
            for (let row = 0; row < this.ROWS; row++) {
                if (this.board[row][col] === this.EMPTY) {
                    return row;
                }
            }
            return -1;
        }
        
        // Make player move
        makeMove(col) {
             // Double-check conditions and check validity
            if (this.gameOver || !this.playerTurn || this.isProcessingMove || !this.isValidMove(col)) {
                return false;
            }

            this.isProcessingMove = true; // Lock input immediately
            this.playerTurn = false; // Player's turn is over

            const row = this.getFirstEmptyRow(col);
             // This check should technically be redundant due to isValidMove, but safety first
            if (row === -1) {
                this.playerTurn = true; // Re-enable player turn if move failed
                this.isProcessingMove = false; // Unlock processing
                return false;
            }

            this.board[row][col] = this.PLAYER;
            this.moveHistory.push({row, col, player: this.PLAYER});
            this.updateBoard(); // Update board visually

            // Check if player won
            if (this.checkWin(row, col, this.PLAYER)) {
                this.winnerMessage.textContent = 'Ви перемогли!';
                this.gameOver = true;
                this.gameOverElement.classList.add('active');
                 // No need to unlock processing here, game is over
                return true;
            }

            // Check for draw
            if (this.isBoardFull()) {
                this.winnerMessage.textContent = 'Нічия!';
                this.gameOver = true;
                this.gameOverElement.classList.add('active');
                 // No need to unlock processing here, game is over
                return true;
            }

             // If game continues, prepare for AI move
            this.boardElement.classList.add('ai-turn'); // Add class to indicate AI's turn visually/disable clicks via CSS
            setTimeout(() => {
                this.makeAIMove();
            }, 500); // AI moves after a short delay

             // Note: isProcessingMove remains true until AI finishes
            return true;
        }
        
        // Check if board is full (draw condition)
        isBoardFull() {
            // Check if the top row (index this.ROWS - 1) is full
            return this.board[this.ROWS - 1].every(cell => cell !== this.EMPTY);
        }
        
        // Undo last move
        undoMove() {
            if (this.moveHistory.length < 2 || this.gameOver) return;
            
            // Undo both player and AI moves
            for (let i = 0; i < 2; i++) {
                if (this.moveHistory.length > 0) {
                    const move = this.moveHistory.pop();
                    this.board[move.row][move.col] = this.EMPTY;
                }
            }
            
            this.updateBoard();
            
            // After undoing both moves, it's the player's turn again
            this.playerTurn = true;
        }
        
        // Evaluate board state for minimax
        evaluateBoard() {
            // Directions: horizontal, vertical, diagonal down-right, diagonal up-right
            const directions = [
                [0, 1],  // horizontal
                [1, 0],  // vertical
                [1, 1],  // diagonal down-right
                [-1, 1]  // diagonal up-right
            ];
            
            let score = 0;
            
            for (let row = 0; row < this.ROWS; row++) {
                for (let col = 0; col < this.COLS; col++) {
                    if (this.board[row][col] !== this.EMPTY) {
                        const player = this.board[row][col];
                        const value = player === this.AI ? 1 : -1;
                        
                        for (const [dx, dy] of directions) {
                            let count = 1;
                            let isEmpty = false;
                            
                            // Check forward direction
                            for (let i = 1; i < this.CONNECT; i++) {
                                const r = row + i * dx;
                                const c = col + i * dy;
                                
                                if (this.isValidCell(r, c)) {
                                    if (this.board[r][c] === player) {
                                        count++;
                                    } else if (this.board[r][c] === this.EMPTY) {
                                        isEmpty = true;
                                        break;
                                    } else {
                                        break;
                                    }
                                }
                            }
                            
                            // If there are at least 2 in a row and an empty space for potential win
                            if (count >= 2 && isEmpty) {
                                score += count * value;
                            }
                            
                            // If there are 4 in a row, large bonus
                            if (count >= this.CONNECT) {
                                score += 100 * value;
                            }
                        }
                    }
                }
            }
            
            return score;
        }
        
        // Minimax algorithm with alpha-beta pruning
        minimax(depth, alpha, beta, isMaximizingPlayer) {
            // Check for immediate win/loss
            for (let row = 0; row < this.ROWS; row++) {
                for (let col = 0; col < this.COLS; col++) {
                    if (this.board[row][col] !== this.EMPTY) {
                        if (this.checkWin(row, col, this.PLAYER)) {
                            return {score: -100 - depth};
                        }
                        if (this.checkWin(row, col, this.AI)) {
                            return {score: 100 + depth};
                        }
                    }
                }
            }
            
            // Check depth and draw
            if (depth === 0 || this.isBoardFull()) {
                return {score: this.evaluateBoard()};
            }
            
            if (isMaximizingPlayer) {
                let maxScore = -Infinity;
                let bestCol = null;
                
                // Try all possible moves
                for (let col = 0; col < this.COLS; col++) {
                    if (this.isValidMove(col)) {
                        const row = this.getFirstEmptyRow(col);
                        this.board[row][col] = this.AI;
                        
                        // Recursively call minimax for next level
                        const result = this.minimax(depth - 1, alpha, beta, false);
                        
                        // Undo move
                        this.board[row][col] = this.EMPTY;
                        
                        if (result.score > maxScore) {
                            maxScore = result.score;
                            bestCol = col;
                        }
                        
                        // Alpha-beta pruning
                        alpha = Math.max(alpha, maxScore);
                        if (alpha >= beta) break;
                    }
                }
                
                return {score: maxScore, col: bestCol};
            } else {
                let minScore = Infinity;
                let bestCol = null;
                
                // Try all possible moves
                for (let col = 0; col < this.COLS; col++) {
                    if (this.isValidMove(col)) {
                        const row = this.getFirstEmptyRow(col);
                        this.board[row][col] = this.PLAYER;
                        
                        // Recursively call minimax for next level
                        const result = this.minimax(depth - 1, alpha, beta, true);
                        
                        // Undo move
                        this.board[row][col] = this.EMPTY;
                        
                        if (result.score < minScore) {
                            minScore = result.score;
                            bestCol = col;
                        }
                        
                        // Alpha-beta pruning
                        beta = Math.min(beta, minScore);
                        if (alpha >= beta) break;
                    }
                }
                
                return {score: minScore, col: bestCol};
            }
        }
        
        // Random move for AI
        randomMove() {
            const validCols = [];
            for (let col = 0; col < this.COLS; col++) {
                if (this.isValidMove(col)) {
                    validCols.push(col);
                }
            }
            
            if (validCols.length > 0) {
                return validCols[Math.floor(Math.random() * validCols.length)];
            }
            
            return -1;
        }
        
        // *** NEW HELPER: Find immediate winning move for a player ***
        findImmediateWin(player) {
            for (let col = 0; col < this.COLS; col++) {
                if (this.isValidMove(col)) {
                    const row = this.getFirstEmptyRow(col);
                    if (row !== -1) {
                        this.board[row][col] = player; // Temporarily make the move
                        const isWin = this.checkWin(row, col, player);
                        this.board[row][col] = this.EMPTY; // Undo temporary move
                        if (isWin) {
                            return col; // Found winning move
                        }
                    }
                }
            }
            return -1; // No immediate winning move found
        }
        
        // Make AI move
        makeAIMove() {
            // AI logic should not run if game is already over
            if (this.gameOver) {
                 this.playerTurn = true; // Ensure player turn is re-enabled if somehow called when game over
                 this.isProcessingMove = false;
                 this.boardElement.classList.remove('ai-turn');
                 return;
            }

            let bestCol = -1;

            // Difficulty-based strategy
            if (this.currentDifficulty > 1) { // Medium or Hard
                // 1. Check if AI can win immediately
                bestCol = this.findImmediateWin(this.AI);

                // 2. If not, check if Player can win immediately and block
                if (bestCol === -1) {
                    bestCol = this.findImmediateWin(this.PLAYER);
                }
            }

            // 3. If no immediate win/block found, or if Easy difficulty
            if (bestCol === -1) {
                 if (this.currentDifficulty === 1) { // Easy
                    bestCol = this.randomMove();
                } else { // Medium or Hard - use Minimax
                    let bestScore = -Infinity;
                    let alpha = -Infinity;
                    let beta = Infinity;
                    // Adjust depth based on difficulty
                    const depth = this.currentDifficulty === 2 ? 3 : 5; // Example depths

                    let possibleMoves = [];
                     for (let c = 0; c < this.COLS; c++) {
                         if (this.isValidMove(c)) {
                             possibleMoves.push(c);
                         }
                     }

                     // Shuffle moves to add variability when scores are equal
                     possibleMoves.sort(() => Math.random() - 0.5);


                    for (const col of possibleMoves) {
                        // No need to check isValidMove again, already filtered
                        const row = this.getFirstEmptyRow(col);
                        if (row !== -1) { // Should always be valid here
                             this.board[row][col] = this.AI;
                             let score = this.minimax(depth, alpha, beta, false); // False because next turn is minimizing (Player)
                             this.board[row][col] = this.EMPTY; // Undo move

                             if (score > bestScore) {
                                 bestScore = score;
                                 bestCol = col;
                             }
                             alpha = Math.max(alpha, score); // Update alpha for pruning

                             // Beta cut-off
                             if (beta <= alpha) {
                                 break;
                             }
                        }
                    }

                    // If minimax didn't find a move (e.g., all moves lead to immediate loss)
                     if (bestCol === -1 && possibleMoves.length > 0) {
                         bestCol = possibleMoves[0]; // Pick the first shuffled valid move as fallback
                     }
                }
            }

            // Fallback if absolutely no move found (e.g., board full, though isBoardFull should catch this)
            if (bestCol === -1) {
                 let validCols = [];
                 for (let c = 0; c < this.COLS; c++) {
                     if (this.isValidMove(c)) validCols.push(c);
                 }
                 if (validCols.length > 0) {
                     bestCol = validCols[Math.floor(Math.random() * validCols.length)];
                 } else {
                     console.error("AI Error: No valid moves found, but board not detected as full.");
                     // Handle potential draw if missed earlier
                     if (!this.gameOver) {
                         this.winnerMessage.textContent = 'Нічия!';
                         this.gameOver = true;
                         this.gameOverElement.classList.add('active');
                     }
                     this.playerTurn = true;
                     this.isProcessingMove = false;
                     this.boardElement.classList.remove('ai-turn');
                     return; // Exit AI move logic
                 }
            }


            // Make the chosen move if one was determined and is valid
            if (bestCol !== -1 && this.isValidMove(bestCol)) {
                const row = this.getFirstEmptyRow(bestCol);
                 if (row !== -1) { // Ensure the determined column is still valid
                     this.board[row][bestCol] = this.AI;
                     this.moveHistory.push({row, col: bestCol, player: this.AI});
                     this.updateBoard(); // Update board visually AFTER making the move

                     // Check if AI won
                     if (this.checkWin(row, bestCol, this.AI)) {
                         this.winnerMessage.textContent = 'Комп\'ютер переміг!';
                         this.gameOver = true;
                         this.gameOverElement.classList.add('active');
                     }
                     // Check for draw AFTER AI move
                     else if (this.isBoardFull()) {
                         this.winnerMessage.textContent = 'Нічия!';
                         this.gameOver = true;
                         this.gameOverElement.classList.add('active');
                     }
                 } else {
                      console.error("AI Logic Error: getFirstEmptyRow returned -1 for a supposedly valid column:", bestCol);
                 }
            } else {
                 console.error("AI Error: Determined bestCol is invalid or -1.", { bestCol });
                  // Attempt to make a random valid move as a final fallback if possible
                  let validCols = [];
                  for (let c = 0; c < this.COLS; c++) {
                      if (this.isValidMove(c)) validCols.push(c);
                  }
                  if(validCols.length > 0) {
                      bestCol = validCols[Math.floor(Math.random() * validCols.length)];
                      const row = this.getFirstEmptyRow(bestCol);
                      if (row !== -1) {
                          this.board[row][bestCol] = this.AI;
                          this.moveHistory.push({row, col: bestCol, player: this.AI});
                          this.updateBoard();
                           // Check win/draw again after fallback move
                           if (this.checkWin(row, bestCol, this.AI)) {
                                this.winnerMessage.textContent = 'Комп\'ютер переміг!';
                                this.gameOver = true;
                                this.gameOverElement.classList.add('active');
                           } else if (this.isBoardFull()) {
                                this.winnerMessage.textContent = 'Нічия!';
                                this.gameOver = true;
                                this.gameOverElement.classList.add('active');
                           }
                      }
                  }
            }

            // Regardless of win/loss/draw, unlock for the next player turn if game not over
            if (!this.gameOver) {
                 this.playerTurn = true;
            }
             this.isProcessingMove = false; // Unlock processing
             this.boardElement.classList.remove('ai-turn'); // Remove indicator class
        }
    }
    
    // Initialize the game
    const game = new ConnectFourGame();
}); 