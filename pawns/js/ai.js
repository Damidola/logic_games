// --- AI Logic ---
function triggerAiMoveWithDelay() {
    if (gameMode !== 'pvai' || currentPlayer !== aiColor || gameOver || aiThinking) {
        if (aiThinking) {
             console.log("AI Trigger cancelled (state changed: gameMode/currentPlayer/gameOver/alreadyThinking).");
             aiThinking = false; updateButtonStates(); // Ensure buttons are re-enabled if cancelled early
        }
        return;
    }
    aiThinking = true;
    updateButtonStates(); // Disable player controls immediately
    console.log(`AI (${aiDifficulty}) thinking...`);
    
    // Используем одинаковое время "обдумывания" для всех животных (800 мс)
    const thinkingTime = AI_THINKING_DELAY_MS; // 800 мс для всех животных

    // Short delay BEFORE calculation (visual feedback that AI is "thinking")
    setTimeout(() => {
        if (gameOver || currentPlayer !== aiColor) { // Re-check state before heavy calculation
             console.log("AI Calculation cancelled (state changed before calc).");
            aiThinking = false; updateButtonStates(); return;
        }

        // Perform the potentially heavy calculation
        const bestMove = calculateAiMove();

        // Apply the main thinking delay *after* calculation is done
        setTimeout(() => {
            aiThinking = false; // Calculation finished, ready to move (or failed)
            if (gameOver || currentPlayer !== aiColor) { // Re-check state AGAIN before making move
                console.log("AI Move execution cancelled (state changed after calc).");
                 updateButtonStates(); return;
            }

            if (bestMove) {
                // Final sanity check: is the piece still there?
                if (boardState[bestMove.from.row]?.[bestMove.from.col] === aiColor) {
                    console.log(`AI making move: ${bestMove.from.row},${bestMove.from.col} -> ${bestMove.to.row},${bestMove.to.col}`);
                    makeMove(bestMove.from.row, bestMove.from.col, bestMove.to.row, bestMove.to.col, bestMove.isEnPassant, bestMove.isCapture);
                } else {
                    console.warn(`AI move cancelled: piece at ${bestMove.from.row},${bestMove.from.col} missing or changed color.`);
                    updateButtonStates(); // Re-enable buttons if move failed
                    checkGameOver(); // Maybe this leads to a stalemate?
                }
            } else {
                // This should ideally only happen if AI truly has no moves
                console.error(`AI (${aiDifficulty}) failed to find any valid move.`);
                updateButtonStates(); // Re-enable buttons
                checkGameOver(); // Check if this results in a win for the player (stalemate)
            }
        }, thinkingTime); // Используем одинаковое время для всех животных

    }, 50); // Short delay before starting calculation
}

function calculateAiMove() {
    console.time(`AI (${aiDifficulty}) Calculation`);
    const boardCopy = JSON.parse(JSON.stringify(boardState));
    const epCopy = enPassantTargetSquare ? JSON.parse(JSON.stringify(enPassantTargetSquare)) : null;
    const moves = getAllMovesForAI(aiColor, boardCopy, epCopy);

    if (moves.length === 0) {
        console.timeEnd(`AI (${aiDifficulty}) Calculation`);
        console.log("AI has no valid moves.");
        return null;
     }

    let bestMove = null;
    try {
        switch (aiDifficulty) {
            case 'completely_random': bestMove = completelyRandomAI(moves); break;
            case 'very_easy': bestMove = veryEasyAI(moves); break;
            case 'easy':      bestMove = easyAI(moves, boardCopy, aiColor, epCopy); break;
            case 'medium':    bestMove = mediumAI(moves, boardCopy, aiColor, epCopy); break;
            case 'advanced':  bestMove = advancedAI(moves, boardCopy, aiColor, epCopy); break;
            case 'hard':      bestMove = hardAI(moves, boardCopy, aiColor, epCopy); break;
            case 'expert':    bestMove = expertAI(moves, boardCopy, aiColor, epCopy); break;
            default:          bestMove = easyAI(moves, boardCopy, aiColor, epCopy); // Fallback
        }
    } catch (error) {
        console.error(`AI (${aiDifficulty}) Calculation Error:`, error);
        bestMove = easyAI(moves, boardCopy, aiColor, epCopy); // Fallback to random move on error
    }
    console.timeEnd(`AI (${aiDifficulty}) Calculation`);

    // Ensure *some* move is returned if AI logic somehow failed but moves exist
    return bestMove || (moves.length > 0 ? easyAI(moves, boardCopy, aiColor, epCopy) : null);
}

function getAllMovesForAI(color, currentBoard, currentEpTarget) {
    const allMoves = [];
    const endRow = (color === 'w') ? 0 : 7;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (currentBoard[r][c] === color) {
                const moves = getValidPawnMoves(r, c, color, currentBoard, currentEpTarget);
                moves.forEach(m => {
                    allMoves.push({
                        from: { row: r, col: c },
                        to: { row: m.row, col: m.col },
                        isCapture: m.isCapture,
                        isEnPassant: m.isEnPassant,
                        reachesEnd: m.row === endRow // Flag if move reaches promotion row
                    });
                });
            }
        }
    }
    return allMoves;
}

// AI Difficulty Levels
function veryEasyAI(moves) {
    if (!moves || moves.length === 0) return null;
    
    // Хомяк любит двигаться по краям доски (первая и последняя колонка)
    const edgeMoves = moves.filter(m => m.to.col === 0 || m.to.col === 7);
    
    // С вероятностью 40% хомяк выбирает ход по краю, если такие есть
    if (edgeMoves.length > 0 && Math.random() < 0.4) {
        console.log("Хомяк бежит по краю доски!");
        return edgeMoves[Math.floor(Math.random() * edgeMoves.length)];
    }
    
    // С вероятностью 30% хомяк может сделать случайный ход, даже если есть выигрышный
    const winningMoves = moves.filter(m => m.reachesEnd);
    if (winningMoves.length > 0 && Math.random() < 0.7) {
        console.log("Хомяк нашел выигрышный ход!");
        return winningMoves[Math.floor(Math.random() * winningMoves.length)];
    }
    
    // С вероятностью 20% хомяк делает взятие, если возможно
    const captureMoves = moves.filter(m => m.isCapture);
    if (captureMoves.length > 0 && Math.random() < 0.2) {
        console.log("Хомяк решил съесть пешку!");
        return captureMoves[Math.floor(Math.random() * captureMoves.length)];
    }
    
    // Иначе случайный ход
    console.log("Хомяк бегает случайно!");
    return moves[Math.floor(Math.random() * moves.length)];
}

// Полностью рандомный AI для обезьяны
function completelyRandomAI(moves) {
    if (!moves || moves.length === 0) return null;
    
    // Обезьяна делает полностью случайные ходы без какой-либо логики
    console.log("Обезьяна делает абсолютно случайный ход!");
    return moves[Math.floor(Math.random() * moves.length)];
}

function easyAI(moves, currentBoard, aiPlayerColor, currentEpTarget) {
    if (!moves || moves.length === 0) return null;
    
    // Капибара всегда использует выигрышные ходы с вероятностью 80%
    const winningMoves = moves.filter(m => m.reachesEnd);
    if (winningMoves.length > 0 && Math.random() < 0.8) {
        console.log("Капибара нашла выигрышный ход!");
        return winningMoves[Math.floor(Math.random() * winningMoves.length)];
    }
    
    // Капибара любит держать пешки вместе - находим ходы, которые держат пешки рядом
    // Подсчитываем для каждого возможного хода, сколько своих пешек будет рядом после хода
    const movesWithNeighborCount = moves.map(move => {
        const { nextBoard } = simulateMove(currentBoard, move, aiPlayerColor);
        let neighborCount = 0;
        
        // Проверяем все соседние клетки после хода
        const row = move.to.row;
        const col = move.to.col;
        for (let r = Math.max(0, row-1); r <= Math.min(7, row+1); r++) {
            for (let c = Math.max(0, col-1); c <= Math.min(7, col+1); c++) {
                if (r === row && c === col) continue; // Пропускаем саму клетку
                if (nextBoard[r]?.[c] === aiPlayerColor) neighborCount++;
            }
        }
        
        return { move, neighborCount };
    });
    
    // Капибара с вероятностью 60% выбирает ход, который держит больше пешек вместе
    if (Math.random() < 0.6) {
        // Сортируем ходы по количеству соседей (больше соседей = лучше)
        movesWithNeighborCount.sort((a, b) => b.neighborCount - a.neighborCount);
        // Берем до 3 лучших ходов и выбираем случайно из них
        const topCount = Math.min(3, movesWithNeighborCount.length);
        const topMoves = movesWithNeighborCount.slice(0, topCount);
        if (topMoves.length > 0 && topMoves[0].neighborCount > 0) {
            console.log("Капибара держится стаей!");
            return topMoves[Math.floor(Math.random() * topCount)].move;
        }
    }
    
    // Капибара с вероятностью 40% приоритезирует взятия
    const captureMoves = moves.filter(m => m.isCapture);
    if (captureMoves.length > 0 && Math.random() < 0.4) {
        console.log("Капибара решила поймать пешку!");
        return captureMoves[Math.floor(Math.random() * captureMoves.length)];
    }
    
    // С вероятностью 30% капибара делает наиболее продвинутый ход вперед
    if (Math.random() < 0.3) {
        // Сортируем ходы по продвижению вперед
        const sortedByAdvance = [...moves].sort((a, b) => {
            const advanceA = aiPlayerColor === 'w' ? (6 - a.to.row) : (a.to.row - 1);
            const advanceB = aiPlayerColor === 'w' ? (6 - b.to.row) : (b.to.row - 1);
            return advanceB - advanceA;
        });
        
        if (sortedByAdvance.length > 0) {
            console.log("Капибара идет вперед!");
            return sortedByAdvance[0];
        }
    }
    
    // В остальных случаях - случайный ход
    console.log("Капибара делает случайный ход");
    return moves[Math.floor(Math.random() * moves.length)];
}

function mediumAI(moves, currentBoard, aiPlayerColor, currentEpTarget) {
    if (!moves || moves.length === 0) return null;
    
    // Кот всегда использует выигрышные ходы
    const winningMoves = moves.filter(m => m.reachesEnd);
    if (winningMoves.length > 0) {
        console.log("Кот нашел выигрышный ход!");
        return winningMoves[Math.floor(Math.random() * winningMoves.length)];
    }
    
    // Кот предпочитает защищенные пешки - проверяем, какие ходы делают пешку защищенной
    const movesWithSafety = moves.map(move => {
        const { nextBoard } = simulateMove(currentBoard, move, aiPlayerColor);
        let isSafe = true;
        const enemyColor = aiPlayerColor === 'w' ? 'b' : 'w';
        
        // Проверяем, не может ли враг съесть пешку после хода
        const row = move.to.row;
        const col = move.to.col;
        const attackDirection = aiPlayerColor === 'w' ? 1 : -1; // Направление атаки противника
        
        // Проверяем диагональные атаки противника
        if ((col > 0 && nextBoard[row + attackDirection]?.[col - 1] === enemyColor) || 
            (col < 7 && nextBoard[row + attackDirection]?.[col + 1] === enemyColor)) {
            isSafe = false;
        }
        
        // Проверяем, защищена ли наша пешка другими нашими пешками
        const isProtected = (col > 0 && nextBoard[row]?.[col - 1] === aiPlayerColor) || 
                           (col < 7 && nextBoard[row]?.[col + 1] === aiPlayerColor) ||
                           (aiPlayerColor === 'w' && row < 7 && 
                               ((col > 0 && nextBoard[row + 1]?.[col - 1] === aiPlayerColor) || 
                                (col < 7 && nextBoard[row + 1]?.[col + 1] === aiPlayerColor))) ||
                           (aiPlayerColor === 'b' && row > 0 && 
                               ((col > 0 && nextBoard[row - 1]?.[col - 1] === aiPlayerColor) || 
                                (col < 7 && nextBoard[row - 1]?.[col + 1] === aiPlayerColor)));
        
        return { 
            move, 
            safety: isSafe ? 2 : (isProtected ? 1 : 0), // 2 - безопасно, 1 - защищено, 0 - опасно
            isCapture: move.isCapture
        };
    });
    
    // Кот предпочитает безопасные взятия с вероятностью 70%
    const safeCapturesOrAdvances = movesWithSafety.filter(m => (m.isCapture || m.move.to.row === (aiPlayerColor === 'w' ? 2 : 5)) && m.safety > 0);
    if (safeCapturesOrAdvances.length > 0 && Math.random() < 0.7) {
        console.log("Кот делает безопасное взятие или продвижение!");
        return safeCapturesOrAdvances[Math.floor(Math.random() * safeCapturesOrAdvances.length)].move;
    }
    
    // С вероятностью 30% кот делает хитрый ход - создаёт угрозу захвата или проходит пешку
    if (Math.random() < 0.3) {
        // Ищем ходы, которые создают возможность взятия на следующем ходу
        const possibleThreats = moves.map(move => {
            const { nextBoard } = simulateMove(currentBoard, move, aiPlayerColor);
            const enemyColor = aiPlayerColor === 'w' ? 'b' : 'w';
            
            // Направление для проверки возможностей взятия
            const attackDir = aiPlayerColor === 'w' ? -1 : 1;
            const row = move.to.row;
            const col = move.to.col;
            
            let threatCount = 0;
            
            // Проверяем, сможем ли мы атаковать вражеские пешки на следующем ходу
            if (col > 0 && nextBoard[row + attackDir]?.[col - 1] === enemyColor) threatCount++;
            if (col < 7 && nextBoard[row + attackDir]?.[col + 1] === enemyColor) threatCount++;
            
            return { move, threatCount };
        });
        
        // Сортируем по количеству потенциальных угроз
        possibleThreats.sort((a, b) => b.threatCount - a.threatCount);
        
        if (possibleThreats.length > 0 && possibleThreats[0].threatCount > 0) {
            console.log("Кот делает хитрый ход создавая угрозу!");
            return possibleThreats[0].move;
        }
    }
    
    // С вероятностью 50% кот выбирает самую безопасную пешку
    if (Math.random() < 0.5) {
        // Сортируем ходы по безопасности
        movesWithSafety.sort((a, b) => b.safety - a.safety);
        
        if (movesWithSafety.length > 0 && movesWithSafety[0].safety > 0) {
            console.log("Кот делает безопасный ход!");
            // Выбираем случайный ход из топ-3 самых безопасных
            const topCount = Math.min(3, movesWithSafety.length);
            return movesWithSafety[Math.floor(Math.random() * topCount)].move;
        }
    }
    
    // В остальных случаях - продвигается вперед
    console.log("Кот продвигается вперед");
    moves.sort((a, b) => {
        const progress = (m) => aiPlayerColor === 'w' ? (m.from.row - m.to.row) : (m.to.row - m.from.row);
        return progress(b) - progress(a); // Сортировка по продвижению вперед
    });
    
    // Выбираем из топ-3 ходов случайно
    const topMovesCount = Math.min(3, moves.length);
    return moves[Math.floor(Math.random() * topMovesCount)];
}

function advancedAI(moves, currentBoard, aiPlayerColor, currentEpTarget) {
    if (!moves || moves.length === 0) return null;
    
    // Собака всегда использует выигрышные ходы
    const winningMoves = moves.filter(m => m.reachesEnd);
    if (winningMoves.length > 0) {
        console.log("Собака нашла выигрышный ход!");
        return winningMoves[Math.floor(Math.random() * winningMoves.length)];
    }

    // Собака агрессивна, приоритезирует взятия и продвижение
    const captureMoves = moves.filter(m => m.isCapture);
    
    // С вероятностью 75% собака выбирает взятие, если оно доступно
    if (captureMoves.length > 0 && Math.random() < 0.75) {
        console.log("Собака атакует и захватывает пешку!");
        return captureMoves[Math.floor(Math.random() * captureMoves.length)];
    }
    
    // Собака любит продвигать пешки глубоко на территорию противника
    // Оцениваем ходы по глубине проникновения и возможностям дальнейшей атаки
    const movesWithAttackPotential = moves.map(move => {
        const { nextBoard } = simulateMove(currentBoard, move, aiPlayerColor);
        const row = move.to.row;
        const col = move.to.col;
        
        // Чем дальше продвинута пешка, тем лучше
        const advancementValue = aiPlayerColor === 'w' ? 
                              (6 - row) * 2 : // Для белых: 0=12, 1=10, 2=8, 3=6, 4=4, 5=2, 6=0
                              (row - 1) * 2; // Для черных: 1=0, 2=2, 3=4, 4=6, 5=8, 6=10, 7=12
        
        // Бонус за центральные колонки, собака предпочитает контролировать центр
        const centerBonus = (col >= 2 && col <= 5) ? 3 : 0;
        
        // Рассчитываем потенциал для атаки после этого хода
        const attackDir = aiPlayerColor === 'w' ? -1 : 1;
        const enemyColor = aiPlayerColor === 'w' ? 'b' : 'w';
        
        // Проверяем, можем ли атаковать что-то после хода
        let attackPotential = 0;
        if (col > 0 && nextBoard[row + attackDir]?.[col - 1] === enemyColor) attackPotential += 4;
        if (col < 7 && nextBoard[row + attackDir]?.[col + 1] === enemyColor) attackPotential += 4;
        
        // Также ценим позиции с потенциалом для продвижения вперед
        if (!nextBoard[row + attackDir]?.[col]) attackPotential += 2;
        
        // Собака предпочитает рисковать, поэтому игнорирует защищенность
        
        return { 
            move, 
            score: advancementValue + centerBonus + attackPotential
        };
    });
    
    // Сортируем ходы по их потенциалу
    movesWithAttackPotential.sort((a, b) => b.score - a.score);
    
    // С вероятностью 60% выбираем лучший ход по нашей оценке
    if (Math.random() < 0.6) {
        console.log("Собака выбирает агрессивное продвижение!");
        // Берем случайный ход из топ-2 с наибольшим потенциалом
        const topCount = Math.min(2, movesWithAttackPotential.length);
        return movesWithAttackPotential[Math.floor(Math.random() * topCount)].move;
    }
    
    // С вероятностью 25% собака использует minimax с глубиной 3 для анализа
    if (Math.random() < 0.25) {
        const maxDepth = MAX_DEPTH_ADVANCED;
        console.log("Собака анализирует позицию, используя minimax...");
        
        let bestMove = null;
        let bestScore = -Infinity;
        
        // Рассматриваем только несколько лучших ходов для экономии времени
        const movesToAnalyze = movesWithAttackPotential.slice(0, Math.min(4, movesWithAttackPotential.length));
        
        for (const moveData of movesToAnalyze) {
            const move = moveData.move;
            const { nextBoard, nextEpTarget } = simulateMove(currentBoard, move, aiPlayerColor);
            const score = minimax(nextBoard, maxDepth - 1, -Infinity, Infinity, false, nextEpTarget, aiPlayerColor, maxDepth);
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        if (bestMove) {
            console.log("Собака выбрала оптимальный ход после анализа!");
            return bestMove;
        }
    }
    
    // В остальных случаях - просто берем случайный ход из топ-3 по оценке потенциала
    console.log("Собака делает один из лучших ходов!");
    const topCount = Math.min(3, movesWithAttackPotential.length);
    return movesWithAttackPotential[Math.floor(Math.random() * topCount)].move;
}

function evaluateBoard(board, maximizingColor) {
    let score = 0;
    const opponentColor = maximizingColor === 'w' ? 'b' : 'w';
    let maximizingPawns = 0; let opponentPawns = 0;

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const piece = board[r]?.[c];
            if (!piece) continue;

            const isMaximizing = piece === maximizingColor;
            if (isMaximizing) maximizingPawns++; else opponentPawns++;

            let pieceScore = PAWN_VALUE;
            let positionalScore = 0;
            if (piece === 'w') { // White piece
                const rankAdvanced = 6 - r; // 0 on start row 6, 6 on end row 0
                if (r === 0) positionalScore = PROMOTION_VALUE; // Reached end
                else if (rankAdvanced >= 0 && rankAdvanced < ADVANCEMENT_BONUS.length) {
                    positionalScore = ADVANCEMENT_BONUS[rankAdvanced];
                }
            } else { // Black piece
                const rankAdvanced = r - 1; // 0 on start row 1, 6 on end row 7
                if (r === 7) positionalScore = PROMOTION_VALUE; // Reached end
                else if (rankAdvanced >= 0 && rankAdvanced < ADVANCEMENT_BONUS.length) {
                    positionalScore = ADVANCEMENT_BONUS[rankAdvanced];
                }
            }
            score += (isMaximizing ? 1 : -1) * (pieceScore + positionalScore);
        }
    }
    // Add material difference bonus (value of having more pawns)
    score += (maximizingPawns - opponentPawns) * CAPTURE_BONUS;

    // Check for immediate win/loss states detected by simple analysis
    // This is a *simplified* check within evaluation, full check happens at terminal nodes
    const winnerEval = getWinnerInternal(board, maximizingColor === 'w' ? 'b' : 'w', null); // Check if opponent would lose if it were their turn
    if (winnerEval === maximizingColor) return WIN_SCORE / 2; // Strong indication of win soon
    if (winnerEval === opponentColor) return -WIN_SCORE / 2; // Strong indication of loss soon

    return score;
}

function minimax(board, depth, alpha, beta, isMaximizing, epTarget, aiPlayerColor, maxDepth) {
    const turnPlayer = isMaximizing ? aiPlayerColor : (aiPlayerColor === 'w' ? 'b' : 'w');

    // Check for terminal state (win/loss/stalemate) using the robust check
    const winner = getWinnerInternal(board, turnPlayer, epTarget); // Check based on whose turn it is
    if (winner !== null) {
        if (winner === aiPlayerColor) return WIN_SCORE - (maxDepth - depth); // Win is good, faster win is better
        if (winner === (aiPlayerColor === 'w' ? 'b' : 'w')) return -WIN_SCORE + (maxDepth - depth); // Loss is bad, faster loss is worse
        if (winner === 'draw') return 0; // Draw due to no moves - neutral value
        return 0; // Any other draw condition - neutral
    }

    // Max depth reached, return static evaluation
    if (depth === 0) {
        return evaluateBoard(board, aiPlayerColor);
    }

    const possibleMoves = getAllMovesForAI(turnPlayer, board, epTarget);

    // This should never happen now since getWinnerInternal checks for no moves,
    // but keep as a safeguard with updated logic for draw
    if (possibleMoves.length === 0) {
        return 0; // Draw due to no moves
    }

    // Move ordering: Prioritize promotions, then captures, then others
    possibleMoves.sort((a, b) => {
        let scoreA = 0; let scoreB = 0;
        if (a.reachesEnd) scoreA += 20; if (b.reachesEnd) scoreB += 20; // Highest priority
        if (a.isCapture) scoreA += 10; if (b.isCapture) scoreB += 10; // Next priority
        return scoreB - scoreA; // Sort descending by score
    });

    let bestVal = isMaximizing ? -Infinity : Infinity;
    for (const move of possibleMoves) {
        const { nextBoard, nextEpTarget } = simulateMove(board, move, turnPlayer);
        const score = minimax(nextBoard, depth - 1, alpha, beta, !isMaximizing, nextEpTarget, aiPlayerColor, maxDepth);

        if (isMaximizing) {
            bestVal = Math.max(bestVal, score);
            alpha = Math.max(alpha, bestVal);
        } else {
            bestVal = Math.min(bestVal, score);
            beta = Math.min(beta, bestVal);
        }

        // Alpha-beta pruning
        if (beta <= alpha) break;
    }
    return bestVal;
}

function hardAI(moves, currentBoard, aiPlayerColor, currentEpTarget) {
    if (!moves || moves.length === 0) return null;
    
    // Пингвин всегда использует выигрышные ходы
    const winningMoves = moves.filter(m => m.reachesEnd);
    if (winningMoves.length > 0) {
        console.log("Пингвин нашел выигрышный ход!");
        return winningMoves[Math.floor(Math.random() * winningMoves.length)];
    }

    // Пингвин предпочитает строить "клин" из пешек - оцениваем ходы по формированию клина
    const movesWithFormation = moves.map(move => {
        const { nextBoard } = simulateMove(currentBoard, move, aiPlayerColor);
        const row = move.to.row;
        const col = move.to.col;
        
        // Считаем, сколько своих пешек в соседних клетках
        let formationScore = 0;
        for (let r = Math.max(0, row-1); r <= Math.min(7, row+1); r++) {
            for (let c = Math.max(0, col-1); c <= Math.min(7, col+1); c++) {
                if (r === row && c === col) continue; // Пропускаем саму клетку
                if (nextBoard[r]?.[c] === aiPlayerColor) formationScore += 1;
            }
        }
        
        // Дополнительные очки за центральные колонки
        const centerBonus = (col >= 2 && col <= 5) ? 2 : 0;
        
        // Дополнительные очки за защищенность
        let safetyScore = 0;
        const enemyColor = aiPlayerColor === 'w' ? 'b' : 'w';
        const attackDirection = aiPlayerColor === 'w' ? 1 : -1;
        
        // Проверяем, не может ли враг съесть пешку после хода
        const isVulnerable = (col > 0 && nextBoard[row + attackDirection]?.[col - 1] === enemyColor) || 
                           (col < 7 && nextBoard[row + attackDirection]?.[col + 1] === enemyColor);
        
        // Проверяем, защищена ли пешка другими нашими пешками
        const isProtected = (col > 0 && nextBoard[row]?.[col - 1] === aiPlayerColor) || 
                          (col < 7 && nextBoard[row]?.[col + 1] === aiPlayerColor) ||
                          (aiPlayerColor === 'w' && row < 7 && 
                              ((col > 0 && nextBoard[row + 1]?.[col - 1] === aiPlayerColor) || 
                               (col < 7 && nextBoard[row + 1]?.[col + 1] === aiPlayerColor))) ||
                          (aiPlayerColor === 'b' && row > 0 && 
                              ((col > 0 && nextBoard[row - 1]?.[col - 1] === aiPlayerColor) || 
                               (col < 7 && nextBoard[row - 1]?.[col + 1] === aiPlayerColor)));
        
        if (!isVulnerable) safetyScore += 3;
        if (isProtected) safetyScore += 2;
        
        // Дополнительные очки за продвижение вперед
        const advancementScore = aiPlayerColor === 'w' ? 
                               (6 - row) : // Для белых: 0=6, 1=5, 2=4, 3=3, 4=2, 5=1, 6=0
                               (row - 1);  // Для черных: 1=0, 2=1, 3=2, 4=3, 5=4, 6=5, 7=6
        
        // Особое внимание к взятиям - но только если они безопасны
        const captureScore = move.isCapture ? (isVulnerable ? 2 : 5) : 0;
        
        return { 
            move, 
            score: formationScore * 2 + centerBonus + safetyScore + advancementScore + captureScore
        };
    });
    
    // Пингвин с вероятностью 40% использует minimax для анализа лучших ходов
    if (Math.random() < 0.4) {
        const maxDepth = MAX_DEPTH_HARD;
        console.log("Пингвин тщательно анализирует позицию с помощью minimax...");
        
        // Выбираем несколько топовых ходов для анализа minimax
        movesWithFormation.sort((a, b) => b.score - a.score);
        const topMovesToAnalyze = movesWithFormation.slice(0, Math.min(4, movesWithFormation.length))
                                 .map(m => m.move);
        
        let bestMove = null;
        let bestScore = -Infinity;
        
        // Анализируем только лучшие ходы с помощью minimax
        for (const move of topMovesToAnalyze) {
            const { nextBoard, nextEpTarget } = simulateMove(currentBoard, move, aiPlayerColor);
            const score = minimax(nextBoard, maxDepth - 1, -Infinity, Infinity, false, nextEpTarget, aiPlayerColor, maxDepth);
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        if (bestMove) {
            console.log("Пингвин выбрал наилучший ход после анализа!");
            return bestMove;
        }
    }
    
    // Сортируем ходы по их общей оценке
    movesWithFormation.sort((a, b) => b.score - a.score);
    
    // С вероятностью 60% выбираем лучший ход по формации
    if (Math.random() < 0.6 && movesWithFormation.length > 0) {
        console.log("Пингвин строит надежную формацию!");
        return movesWithFormation[0].move;
    }
    
    // С вероятностью 30% выбираем случайный ход из топ-3
    if (Math.random() < 0.3 && movesWithFormation.length > 0) {
        console.log("Пингвин выбирает один из лучших ходов!");
        const topCount = Math.min(3, movesWithFormation.length);
        return movesWithFormation[Math.floor(Math.random() * topCount)].move;
    }
    
    // В остальных случаях - используем безопасные взятия, если они есть
    const safeCapturesOrAdvances = movesWithFormation.filter(m => 
        (m.move.isCapture || m.score > 5) && 
        m.score >= (movesWithFormation[0].score * 0.7));
        
    if (safeCapturesOrAdvances.length > 0) {
        console.log("Пингвин делает тактический ход!");
        return safeCapturesOrAdvances[Math.floor(Math.random() * safeCapturesOrAdvances.length)].move;
    }
    
    // Если все остальное не сработало, используем ход с лучшей оценкой
    console.log("Пингвин выбирает оптимальный ход!");
    return movesWithFormation[0].move;
}

function expertAI(moves, currentBoard, aiPlayerColor, currentEpTarget) {
    if (!moves || moves.length === 0) return null;

    // Тигр всегда использует выигрышные ходы
    const winningMoves = moves.filter(m => m.reachesEnd);
    if (winningMoves.length > 0) {
        console.log("Тигр нашел выигрышный ход!");
        return winningMoves[Math.floor(Math.random() * winningMoves.length)];
    }

    // Тигр играет стратегически и агрессивно
    // Сначала выполним комплексную оценку каждого хода
    const movesWithEvaluation = moves.map(move => {
        const { nextBoard, nextEpTarget } = simulateMove(currentBoard, move, aiPlayerColor);
        const row = move.to.row;
        const col = move.to.col;
        const enemyColor = aiPlayerColor === 'w' ? 'b' : 'w';
        
        // Базовая оценка позиции после хода
        const positionScore = evaluateBoard(nextBoard, aiPlayerColor);
        
        // Проверяем, создаёт ли ход угрозу противнику
        let threatLevel = 0;
        const attackDir = aiPlayerColor === 'w' ? -1 : 1;
        
        // Проверяем, можем ли атаковать вражеские пешки на следующем ходу
        if (col > 0 && nextBoard[row + attackDir]?.[col - 1] === enemyColor) threatLevel += 3;
        if (col < 7 && nextBoard[row + attackDir]?.[col + 1] === enemyColor) threatLevel += 3;
        
        // Дополнительные очки за центральные колонки и продвинутые позиции
        const centerBonus = (col >= 2 && col <= 5) ? 2 : 0;
        const advancementScore = aiPlayerColor === 'w' ? 
                               (6 - row) : // Для белых
                               (row - 1);  // Для черных
                               
        // Тигр предпочитает захваты, если они не слишком рискованные
        const isCaptureRisky = isRiskyCapture(nextBoard, row, col, aiPlayerColor);
        const captureScore = move.isCapture ? (isCaptureRisky ? 2 : 5) : 0;
        
        // Предпочитаем ходы, которые создают "опорные пункты" - защищенные продвинутые позиции
        const isOutpost = isDefendedOutpost(nextBoard, row, col, aiPlayerColor);
        const outpostScore = isOutpost ? 4 : 0;
        
        // Взвешенная оценка хода
        const immediateEvaluation = threatLevel + centerBonus + advancementScore * 1.5 + captureScore + outpostScore;
        
        return { 
            move, 
            immediateScore: immediateEvaluation,
            positionScore
        };
    });
    
    // С вероятностью 15% Тигр делает непредсказуемый, но потенциально хороший ход
    if (Math.random() < 0.15) {
        // Выбираем случайный ход из топ-5 ходов
        movesWithEvaluation.sort((a, b) => b.immediateScore - a.immediateScore);
        const topChoices = movesWithEvaluation.slice(0, Math.min(5, movesWithEvaluation.length));
        if (topChoices.length > 0) {
            console.log("Тигр делает непредсказуемый ход!");
            return topChoices[Math.floor(Math.random() * topChoices.length)].move;
        }
    }
    
    // С вероятностью 70% Тигр использует глубокий анализ minimax
    if (Math.random() < 0.7) {
        const maxDepth = MAX_DEPTH_EXPERT;
        console.log("Тигр анализирует позицию глубоко с помощью minimax...");
        
        // Сначала выбираем топ-ходы для детального анализа на основе их непосредственной оценки
        movesWithEvaluation.sort((a, b) => b.immediateScore - a.immediateScore);
        const topMovesToAnalyze = movesWithEvaluation.slice(0, Math.min(5, movesWithEvaluation.length))
                                  .map(m => m.move);
        
        let bestMove = null;
        let bestScore = -Infinity;
        let moveScores = []; // Для логирования
        
        // Анализ наиболее перспективных ходов
        for (const move of topMovesToAnalyze) {
            const { nextBoard, nextEpTarget } = simulateMove(currentBoard, move, aiPlayerColor);
            // Глубокий анализ с minimax
            const score = minimax(nextBoard, maxDepth - 1, -Infinity, Infinity, false, nextEpTarget, aiPlayerColor, maxDepth);
            
            moveScores.push({ from: move.from, to: move.to, score });
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        if (bestMove) {
            console.log("Тигр выбрал оптимальный ход после глубокого анализа!");
            console.log("Оценки ходов:", moveScores);
            return bestMove;
        }
    }
    
    // С вероятностью 20% Тигр делает ход, создающий максимальные угрозы
    if (Math.random() < 0.2) {
        // Сортируем по угрозам и взятиям
        movesWithEvaluation.sort((a, b) => {
            // Приоритизируем ходы с наибольшим тактическим потенциалом
            return b.immediateScore - a.immediateScore;
        });
        
        if (movesWithEvaluation.length > 0) {
            console.log("Тигр делает агрессивный ход, создавая угрозы!");
            return movesWithEvaluation[0].move;
        }
    }
    
    // В остальных случаях оцениваем ходы по их позиционной ценности
    movesWithEvaluation.sort((a, b) => b.positionScore - a.positionScore);
    
    console.log("Тигр делает стратегически сильный ход!");
    return movesWithEvaluation[0].move;
}

// Вспомогательная функция для проверки, является ли взятие рискованным
function isRiskyCapture(board, row, col, color) {
    const enemyColor = color === 'w' ? 'b' : 'w';
    const attackDirection = color === 'w' ? 1 : -1; // Направление атаки противника
    
    // Проверяем, не может ли враг съесть нашу пешку после взятия
    return (col > 0 && board[row + attackDirection]?.[col - 1] === enemyColor) || 
           (col < 7 && board[row + attackDirection]?.[col + 1] === enemyColor);
}

// Вспомогательная функция для проверки, является ли позиция защищенным опорным пунктом
function isDefendedOutpost(board, row, col, color) {
    // Пешка должна быть продвинута достаточно далеко на территорию противника
    const isAdvanced = (color === 'w' && row <= 3) || (color === 'b' && row >= 4);
    if (!isAdvanced) return false;
    
    // Проверяем, защищена ли пешка другими своими пешками
    const isProtected = 
        (col > 0 && board[row]?.[col - 1] === color) || 
        (col < 7 && board[row]?.[col + 1] === color) ||
        (color === 'w' && row < 7 && 
            ((col > 0 && board[row + 1]?.[col - 1] === color) || 
             (col < 7 && board[row + 1]?.[col + 1] === color))) ||
        (color === 'b' && row > 0 && 
            ((col > 0 && board[row - 1]?.[col - 1] === color) || 
             (col < 7 && board[row - 1]?.[col + 1] === color)));
    
    return isProtected;
}

function simulateMove(board, move, playerColor) {
    // Create a deep copy of the board for simulation
    const nextBoard = JSON.parse(JSON.stringify(board));
    
    // Initialize EP target as null
    let nextEpTarget = null;
    
    // Check if this is a two-step move (pawn's first move)
    const isTwoStep = Math.abs(move.to.row - move.from.row) === 2;
    if (isTwoStep) {
        // Set EP target to the square "jumped over" by the pawn
        nextEpTarget = { 
            row: Math.floor((move.from.row + move.to.row) / 2), 
            col: move.to.col 
        };
    }
    
    // Handle En Passant captures
    if (move.isEnPassant && move.isCapture) {
        // For EP, the captured pawn is on the same row as the attacking pawn, not the target square
        const capturedRow = move.from.row;
        const capturedCol = move.to.col;
        nextBoard[capturedRow][capturedCol] = null; // Remove the captured pawn
    }
    
    // Move the piece
    nextBoard[move.to.row][move.to.col] = playerColor;
    nextBoard[move.from.row][move.from.col] = null;
    
    return { nextBoard, nextEpTarget };
}

// Internal win detection used by AI
function getWinnerInternal(board, turnPlayer, epTarget) {
    let whiteCount = 0, blackCount = 0;
    let whiteReachedEnd = false, blackReachedEnd = false;
    
    // Count pieces and check for promotions
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const piece = board[r]?.[c];
            if (piece === 'w') {
                whiteCount++;
                if (r === 0) whiteReachedEnd = true; // White reached black's end (row 0)
            } else if (piece === 'b') {
                blackCount++;
                if (r === 7) blackReachedEnd = true; // Black reached white's end (row 7)
            }
        }
    }
    
    // Check for end conditions
    if (whiteReachedEnd) return 'w'; // White wins by promotion
    if (blackReachedEnd) return 'b'; // Black wins by promotion
    if (whiteCount === 0 && blackCount > 0) return 'b'; // Black wins by capturing all white pawns
    if (blackCount === 0 && whiteCount > 0) return 'w'; // White wins by capturing all black pawns
    
    // Check for stalemate (no valid moves)
    const currentPlayerMoves = getAllMovesForAI(turnPlayer, board, epTarget);
    if (currentPlayerMoves.length === 0) {
        // Changed: If current player has no moves, it's a draw now, not a win for the other player
        // Return 'draw' to indicate a draw state
        return 'draw';
    }
    
    // No winner yet
    return null;
}
