# Description

This Bittrex trading bot trades on the Bittrex market and takes inputs from a telegram bot. Once given a valid Bittrex market link, it
* Automatically iterates through each sell block in the order book and buys the quantity demanded if the buy conditions are met. The default conditions are a comparison between daily low and daily high (whether daily high is within x% of daily low), and a comparison between daily low and current price (whether the current price is within x% of daily low). Both are changable (will explain below).
* Immediately after the buy transaction, marks up the coin by the mark up percentage set and sell it. Since in some larger quantity demands, the buy will consist of multiple sell blocks (hence slightly different buy price), the marked-up sell rate will differentiate between each price

This bot can be deployed either locally or on the cloud

# Local Deployment
1. Git clone or download the repository as a .zip
2. Navigate to the project directory in terminal and run ```npm install``` to grab the dependencies.
3. Create an .env file in the main project directory, and copy and paste these:
    
    ```javascript
    highLowPercent = YOUR VALUE HERE;
    // This is the percentage to check whether the current price is within x% of the daily low
    lowCurrentPercent = YOUR VALUE HERE;
    // This is the percentage to check whether the daily high is within x% of the daily low
    sellPercent = YOUR VALUE HERE;
    // This is your buy quantity in terms of BTC per transaction
    q = YOUR VALUE HERE;
    // This is the percentage you'll mark the coins up by for selling
    tradeFee = 0.25;
    // For Bittrex, the commission per trade 0.25 (percent, just put in 0.25, the script will do the rest)
    ```

4. Make sure to replace the place holders with your desired percentages. The quantity listed there is in terms of BTC instead of coin interested (it will be automatically converted to whatever coin is being targeted at the beginning of the script)
5. Generate an API key and secret pair from [Bittrex](https://bittrex.com/Manage#sectionApi). You will need to sign up for an account before getting access to the API.
6. Create a telegram bot via botfather by talking to @botfather on telegram, type in /newbot and follow the instructions. At the end take down the telegram access token and insert it into telegramAPI_KEY.js file under the statics folder.
7. Run ```node index.js```, feed your bot a valid Bittrex market link and start trading!

# Cloud Deployment (Heroku):
1. Sign up at [Heroku](https://signup.heroku.com/login) and create a new app via the web interface.
2. Go to setting, click on "Reveal Config Vars" button and create 5 name value pairs (order does not matter, the left box is name, the right box is the value):
    * lowCurrentPercent
        * This is the percentage to check whether the current price is within x% of the daily low
    * highLowPercent
        * This is the percentage to check whether the daily high is within x% of the daily low
    * q
        * This is your buy quantity in terms of BTC per transaction
    * sellPercent
        * This is the percentage you'll mark the coins up by for selling
    * tradeFee
        * For Bittrex, the commission per trade is 0.25 (percent, just put in 0.25, the script will do the rest)
3. Install [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli#download-and-install) so you can deploy the bot via terminal commands. 
4. Initiate a git repository in the project folder by running ```git init```.
5. Run ```heroku login``` to log into your heroku account in terminal.
6. Run ```heroku git:remote -a <the name of your heroku app>```.
7. Commit and deploy your code by running these command in succession in terminal:

    ```sh
    $ git add .
    $ git commit -m "initial commit"
    $ git push heroku master
    ```

8. Wait for Heroku to finish building. Run ```heroku ps``` to check whether the app is up. If it's up, feed your telegram bot a valid Bittrex market link and happy trading!

# Different Conditions (Advanced):

Since there is a mechanic in place to pull market data from the Bittrex API about the coin interested, there're a variety of information that is returned:
* MarketName
* High
* Low
* Volume
* Last
* BaseVolume
* TimeStamp
* Bid
* Ask
* OpenBuyOrders
* OpenSellOrders
* PrevDay
* Created

For sample returning data, go to Bittrex's [API Doc](https://bittrex.com/Home/Api) and search for method "/public/getmarketsummary".

With these information, you can construct really any condition you want. If you do decide to write up custom conditions, make sure to update the condition check at index.js line 31. Also if you wish to change up the names of environment configuration variables established either locally or in heroku to better reflect your new conditions, make sure to also update them in the code at index.js line 18 & 19 to avoid errors.