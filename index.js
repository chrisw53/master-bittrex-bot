'use strict';

const bittrex = require('node.bittrex.api');
const telegram = require('./statics/telegramAPI_KEY');

bittrex.options({
    'apikey': 'YOUR_BITTREX_API_KEY',
    'apisecret': 'YOUR_BITTREX_API_SECRET',
    'verbose': true,
    'cleartext': false,
    'baseUrl': 'https://bittrex.com/api/v1.1',
});

/**
 * Listener function for user telegram function 
 */
telegram.on('message', (msg) => {
    const chatId = msg.chat.id;
    const messageFromTelegram = msg.text.split('=');
    const market = messageFromTelegram[1];
    const highLowPercent = (1 + process.env.highLowPercent/100) || 1.1;
    const lowCurrentPercent = (1 + process.env.lowCurrentPercent/100) || 1.1;

    bittrex.getbalance({currency: 'BTC'}, (data) => {
        if (data.result.Available >= process.env.q) {
            bittrex.getmarketsummary({market: market}, (data) => {
                if (data.result) {
                const quantNeeded = (process.env.q / data.result[0].Ask)/(1 - process.env.tradeFee);
                let quantHave = 0;

                console.log(`Initial quant needed = ${quantNeeded}`);

                /*
                 Parameter checks are here. This compares daily low with the ask price and
                 daily high with daily low
                */
                if (data.result[0].Ask < (data.result[0].Low * lowCurrentPercent)
                    && data.result[0].High < (data.result[0].Low * highLowPercent)) {
                    bittrex.getorderbook({
                        market: market,
                        type: 'sell',
                        depth: 50},
                        (data) => {
                            /**
                             * Loops over the result array
                             * while making buy & sell async calls
                             * @param {array} array
                             * @param {number} quantHave
                             */
                            function syncLoop(array, quantHave) {
                                const tradeFee = (1 + process.env.tradeFee/100) || 1.0025;
                                const sellPercent = (1 + process.env.sellPercent/100) || 1.10;

                                console.log('Loop happened');
                                if (array && array.length !== 0) {
                                    const chunkQuantity = array[0].Quantity;
                                    const buyRate = array[0].Rate;
                                    const sellRate = buyRate * sellPercent * tradeFee;
                                    const quantToBuy = quantNeeded - quantHave;
                                    const isLastLoop = chunkQuantity > quantToBuy;

                                    /*
                                     If the quantity needed cannot be satisfied by current block, 
                                     syncLoop is called again to move onto the next block after 
                                     buying the current block. This is needed because Bittrex API
                                     v1.1 does not allow market buy and this is to use limit buy
                                     to simulate market buy by manually fielding Fill or Kill limit
                                     buy order until the total buy quantity is met.
                                    */ 
                                    if (!isLastLoop) {
                                        console.log(
                                            `The quant have vs quant needed: ${quantHave < quantNeeded} quantNeeded: ${quantNeeded} The quantity I have is ${quantHave} The chunk quantity is ${chunkQuantity} It's the last loop: ${isLastLoop} The buy rate is ${buyRate}`
                                        );

                                        bittrex.buylimit({
                                            market: market,
                                            quantity: chunkQuantity,
                                            rate: buyRate,
                                        }, (data) => {
                                            if (data.success) {
                                                console.log(`A buy order went through. ${chunkQuantity} ${market} coins. Rate is ${buyRate}`);

                                                quantHave = quantHave + chunkQuantity;

                                                /* 
                                                 Immediately after the buy order is processed, a limit sell
                                                 order is processed to with a user determined marked up rate
                                                */
                                                bittrex.selllimit({
                                                    market: market,
                                                    quantity: chunkQuantity,
                                                    rate: sellRate,
                                                }, (data) => {
                                                    if (data.success) {
                                                        const sellMsg = `A sell order went through. For ${chunkQuantity} ${market} coins Rate is ${sellRate}`;

                                                        telegram.sendMessage(chatId, sellMsg);

                                                        console.log(sellMsg);

                                                        array.shift();
                                                        // syncLoop is recalled here
                                                        syncLoop(array, quantHave);
                                                    } else if (!data.success) {
                                                        console.log(`sell failed: ${data.message}`);
                                                    } else {
                                                        console.log(
                                                            'The sell order did not reach bittrex'
                                                        );
                                                    }
                                                });
                                            } else if (!data.success) {
                                                console.log(`buy failed: ${data.message}`);
                                                telegram.sendMessage(chatId, `buy failed: ${data.message}`);
                                            } else {
                                                console.log(
                                                    `The buy order request did not reach bittrex. Quantity: ${chunkQuantity}. Rate: ${buyRate}`
                                                );
                                                telegram.sendMessage(chatId, 'The buy order request did not reach bittrex')
                                            }
                                        });
                                    /*
                                     If the current block satisfies the quantity needed, a single limit buy
                                     and limit sell request pair is sent and that's it
                                    */
                                    } else if (isLastLoop) {
                                        console.log(`Last round, quant need to buy is ${quantToBuy}, quant have so far is ${quantHave}`);

                                        bittrex.buylimit({
                                            market: market,
                                            quantity: quantToBuy,
                                            rate: buyRate,
                                        }, (data) => {
                                            if (data.success) {
                                                const buySuccessMsg = 'All of your buys went through!';

                                                telegram.sendMessage(chatId, buySuccessMsg);
                                                console.log(buySuccessMsg);

                                                bittrex.selllimit({
                                                    market: market,
                                                    quantity: Number(Math.floor(quantToBuy - 0.00000001 + 'e+8')+'e-8'),
                                                    rate: sellRate,
                                                }, (data) => {
                                                    if (data.success) {
                                                        const finalSellSuccessMsg = `Your final sell of ${quantToBuy} ${market} went through at the rate of ${sellRate}`;

                                                        telegram.sendMessage(chatId, finalSellSuccessMsg);
                                                        console.log(finalSellSuccessMsg);
                                                    } else if (!data.success) {
                                                        console.log(`Something went wrong with the final sell: ${data.message}`);

                                                        bittrex.selllimit({
                                                            market: market,
                                                            quantity: Number(Math.floor(quantToBuy - 0.00000001 + 'e+8')+'e-8'),
                                                            rate: sellRate,
                                                        }, (data) => {
                                                            if (data.success) {
                                                                const finalSellSuccessMsg = `Your final sell of ${quantToBuy} ${market} went through at the rate of ${sellRate}`;

                                                                telegram.sendMessage(chatId, finalSellSuccessMsg);
                                                                console.log(finalSellSuccessMsg);
                                                            } else if (!data.success) {
                                                                console.log(`Something went wrong with the final sell: ${data.message}`);
                                                            }
                                                        });
                                                    } else {
                                                        console.log('The final sell call did not send to bittrex');
                                                    }
                                                });
                                            } else if (!data.success) {
                                                console.log(`final buy failed: ${data.message}`);
                                                telegram.sendMessage(chatId, `final buy failed: ${data.message}`);
                                            } else {
                                                console.log(
                                                    `The final buy order did not reach bittrex. Quantity: ${quantToBuy}, Rate: ${buyRate}`
                                                );
                                            }
                                        });
                                    }
                                }
                            }
                            // initializes syncLoop function
                            syncLoop(data.result, quantHave);
                        }
                    );
                // Handles the cases where the parameters are not met
                } else if (data.result[0].Ask > (data.result[0].Low * lowCurrentPercent)
                    && data.result[0].High < (data.result[0].Low * highLowPercent)) {
                        const lowAskMsg = `The current ask price is ${data.result[0].Ask}, it is larger than the daily low times the percentage set: ${data.result[0].Low * lowCurrentPercent}, bot will not initiate`;
                        telegram.sendMessage(chatId, lowAskMsg);
                    } else if (data.result[0].Ask < (data.result[0].Low * lowCurrentPercent)
                    && data.result[0].High > (data.result[0].Low * highLowPercent)) {
                        const highLowMsg = `The daily high is ${data.result[0].High}, it is larger than the daily low times the percentage set: ${data.result[0].Low * highLowPercent}, bot will not initiate`;
                        telegram.sendMessage(chatId, highLowMsg);
                    } else {
                        const highLowLowAskMsg = 'Both daily high vs daily low and daily low vs current price tests were not passed, bot will not initiate';
                        telegram.sendMessage(chatId, highLowLowAskMsg);
                    }
            // Handles the case where the market link entered is invalid
                } else {
                const marketErrMsg = 'Please enter a valid market link';
                telegram.sendMessage(chatId, marketErrMsg);
            }
            });
        // Handles the case where the user does not have enough fund to cover the buy
        } else {
            const insufficientFundMsg = `Your balance is ${data.result.Available}, it is less than the buy quantity you set up (${process.env.q}), bot will not initiate`;
            telegram.sendMessage(chatId, insufficientFundMsg);
        }
    });
});