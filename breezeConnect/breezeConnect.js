var sha256 = require("crypto-js/sha256");
const io = require("socket.io-client");
const axios = require('axios');
const urls = require("./config").urls;
const responseMessage = require('./config').responseMessage;
const exceptionMessage = require('./config').exceptionMessage;
const tuxToUserMap = require('./config').tuxToUserMap;
const apiRequest = require('./config').apiRequest;
const apiEndpoint = require('./config').apiEndpoint;
const typeList = require('./config').typeList;
const scriptMasterFile = require('./config').scriptMasterFile;
const feedIntervalMap = require('./config').feedIntervalMap;
const channelIntervalMap = require('./config').channelIntervalMap;
const roomName = require('./config').roomName;
const AdmZip = require('adm-zip');
const { parse } = require('csv-parse/sync');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

var BreezeConnect = function(params) {
    var self = this;
    
    self.version = "0.1";
    self.appKey = params.appKey || "";
    self.userId = "";
    self.secretKey = "";
    self.socket = null;
    self.socketOrder = null;
    self.socketOHLCV = null;
    self.sessionKey = "";
    self.apiSession = "";
    self.onTicks = null;
    self.stockScriptDictList = [];
    self.tokenScriptDictList = [];
    self.tuxToUserValue = tuxToUserMap;

    self.socketConnectionResponse= function(message){
        return {"message":message};
    }

    self.subscribeException = function(message){
        throw message;
    }

    self.validationErrorResponse = function(message){
        return {
                    "Success": "", 
                    "Status": 500, 
                    "Error": message
                };
    }

    self.errorException = function(funcName,error){
        var message = `${funcName}() Error`;
        throw message + error.stack;
    }

    String.prototype.format = function () {
        var args = arguments;
        return this.replace(/{([0-9A-Z]+)}/g, function (match, index) {
          return typeof args[index] == 'undefined' ? match : args[index];
        });
      };

    self.connect = function ({isOrder=false,isOHLCV=false}) {
        if(isOrder == false && isOHLCV==false)
        {
            self.socket = io.connect(urls.LIVE_STREAM_URL, {
                auth: {
                    user: self.userId,
                    token: self.sessionKey
                },
                extraHeaders:{
                    "User-Agent": "node-socketio[client]/socket"
                },
                //reconnectionAttempts: 10,
                transports: ["websocket"],
            });
        }
        else if(isOrder == true)
        {
            self.socketOrder = io.connect(urls.LIVE_FEEDS_URL,{
                auth: {
                    user: self.userId,
                    token: self.sessionKey,
                },
                extraHeaders:{
                    "User-Agent": "node-socketio[client]/socket"
                },
                //reconnectionAttempts: 10,
                transports: ["websocket"],
            });
        }
        else if(isOHLCV == true){
            self.socketOHLCV = io.connect(urls.LIVE_OHLC_STREAM_URL,{
                path:"/ohlcvstream/",
                auth: {
                    user: self.userId,
                    token: self.sessionKey,
                },
                extraHeaders:{
                    "User-Agent": "node-socketio[client]/socket"
                },
                transports: ["websocket"],
            });
        }
        
    };

    self.onDisconnect = function() {
        self.socket.disconnect();
    };
    
    self.generateSession = async function (secretKey,sessionKey) {
        self.sessionKey = sessionKey;
        self.secretKey = secretKey;
        await self.apiUtil();
        await self.getStockScriptList();
    };

    self.apiUtil = async function(){
        try {
            
            headers = {
                "Content-Type": "application/json"
            }
            body = {
                "SessionToken": self.sessionKey,
                "AppKey": self.appKey
            }
            let response = await self.makeRequest(apiRequest.GET, apiEndpoint.CUST_DETAILS, body, headers);
            if(response.data['Status']==500){
                self.subscribeException(exceptionMessage.AUTHENICATION_EXCEPTION);
            }
            else{
                self.apiSession = response.data['Success']['session_token'];
                decodedKey = Buffer.from(self.apiSession,'base64').toString('ascii');
                self.userId = decodedKey.split(':')[0];
                self.sessionKey = decodedKey.split(':')[1];
            }
        } catch (error) {
            self.subscribeException(exceptionMessage.AUTHENICATION_EXCEPTION);
        }
    }

    self.watch = function (symbols) {
        if (!self.socket) {
            return;
        } 
        self.socket.emit("join", symbols);
        self.socket.on('stock', self.onMessage);
    };

    self.watchStrategy = function (symbols) {
        if (!self.socketOrder) {
            return;
        } 

        self.socketOrder.emit("join", symbols);
        self.socketOrder.on('stock', self.onMessageStrategy);
    };

    self.unwatchStrategy = function(symbols)
    {
        if(!self.socketOrder)
        {
            return;
        }
        self.socketOrder.emit("leave",symbols);
    }

    self.onOhlcStream = function(data){
        let parsedData = self.parseOhlcData(data);
        self.onTicks(parsedData);
    }

    self.watchStreamData = function(symbols,channel){
        if (!self.socketOHLCV) {
            return;
        } 
        self.socketOHLCV.emit("join", symbols);
        self.socketOHLCV.on(channel, self.onOhlcStream);
    }

    self.unwatchStreamData = function (symbol) {
        self.socketOHLCV.emit("leave", symbol);
    };


    self.on = function (callback) {
        self.socket.on("stock", callback);
    };

    self.onMessage = function(data){
        data = self.parseData(data);
        self.onTicks(data);
    }

    self.onMessageStrategy = function(data)
    {
        data = self.parseStrategyData(data);
        self.onTicks(data);
    }

    self.notify = function(){
        self.socketOrder.on('order', self.onMessage)
    }

    self.unwatch = function (symbol) {
        self.socket.emit("leave", symbol);
    };

    self.wsConnectOrder = function()
    {
        if(!self.socketOrder)
        {
            self.connect({isOrder:true});    
        }
    }

    self.wsConnect = function(){
        if (!self.socket){
            self.connect({isOrder:false,isOHLCV:false});
            
        }
    }
    
    self.wsDisconnect = function(){
        if(self.socket)
            self.onDisconnect();
    }

    self.getDataFromStockTokenValue = function(inputStockToken){
        var outputData = {};
        var stockToken = inputStockToken.split(".");
        var exchangeType= stockToken[0];
        var stockToken = stockToken[1].split("!")[1];
        var exchangeCodeList={
            "1":"BSE",
            "4":"NSE",
            "13":"NDX",
            "6":"MCX",
        };

        var exchangeCodeName = exchangeCodeList[exchangeType] || false;
        if(exchangeCodeName == false)
            self.subscribeException(exceptionMessage.WRONG_EXCHANGE_CODE_EXCEPTION);
        else if(exchangeCodeName.toLowerCase() == "bse"){
            stockData = self.tokenScriptDictList[0][stockToken] || false;
            if(stockData == false)
                self.subscribeException(exceptionMessage.STOCK_NOT_EXIST_EXCEPTION.format("BSE",inputStockToken));
        }
        else if(exchangeCodeName.toLowerCase() == "nse"){
            stockData = self.tokenScriptDictList[1][stockToken] || false;
            if(stockData == false){
                stockData = self.tokenScriptDictList[4][stockToken] || false;
                if(stockData == false)
                    self.subscribeException(exceptionMessage.STOCK_NOT_EXIST_EXCEPTION.format("i.e. NSE or NFO",inputStockToken));
                else
                    exchangeCodeName = "NFO";
            }
        }
        else if(exchangeCodeName.toLowerCase() == "ndx"){
            stockData = self.tokenScriptDictList[2][stockToken] || false;
            if(stockData == false)
                self.subscribeException(exceptionMessage.STOCK_NOT_EXIST_EXCEPTION.format("NDX",inputStockToken));
        }
        else if(exchangeCodeName.toLowerCase() == "mcx"){
            stockData = self.tokenScriptDictList[3][stockToken] || false;
            if(stockData == false)
                self.subscribeException(exceptionMessage.STOCK_NOT_EXIST_EXCEPTION.format("MCX",inputStockToken));
        }
        outputData["stock_name"] = stockData[1];
        var exchCodes = ["nse","bse"];
        if (!Boolean(exchCodes.includes(exchangeCode.toLowerCase()))){
            var productType = stockData[0].split("-")[0];
            if(productType.toLowerCase()=="fut")
                outputData["product_type"] = "Futures";
            if(productType.toLowerCase()=="opt")
                outputData["product_type"] = "Options";
            var dateString = ""
            for(let date of stockData[0].split("-").slice(2,5))
                dateString += date + "-";
            outputData["strike_date"] = dateString.slice(0,-1);
            if(stockData[0].split("-")>5){
                outputData["strike_price"] = stockData[0].split("-")[5];
                var right = stockData[0].split("-")[6];
                if(right.toUpperCase()=="PE")
                    outputData["right"] = "Put";
                if(righttoUpperCase()=="CE")
                    outputData["right"] = "Call";
            }
        }
        return outputData
    }

    self.getStockTokenValue = function ({exchangeCode="", stockCode="", productType="", expiryDate="", strikePrice="", right="", getExchangeQuotes=true, getMarketDepth=true, interval=""}) {
        if (getExchangeQuotes === false && getMarketDepth === false) {
            self.subscribeException(exceptionMessage.QUOTE_DEPTH_EXCEPTION);
        } else {
            var exchangeCodeName = "";
            var exchangeCodeList={
                "BSE":"1.",
                "NSE":"4.",
                "NDX":"13.",
                "MCX":"6.",
                "NFO":"4.",
                "BFO":"2.",
            };

            if (interval == "" || interval == null) {
                exchangeCodeList["BFO"] = "8.";
            } else {
                exchangeCodeList["BFO"] = "2.";
            }
            var exchangeCodeName = exchangeCodeList[exchangeCode] || false;
            if(exchangeCodeName === false) {
                self.subscribeException(exceptionMessage.EXCHANGE_CODE_EXCEPTION);
            } 
            else if(stockCode === "") {
                self.subscribeException(exceptionMessage.EMPTY_STOCK_CODE_EXCEPTION);
            }
            else {
                var tokenValue = false;
                if(exchangeCode.toLowerCase() === "bse") {
                    var tokenValue = self.stockScriptDictList[0][stockCode] || false;
                }
                else if(exchangeCode.toLowerCase() === "nse"){
                    tokenValue = self.stockScriptDictList[1][stockCode] || false;
                }
                else {
                    if(expiryDate === "") {
                        self.subscribeException(exceptionMessage.EXPIRY_DATE_EXCEPTION);
                    }
                    if(productType.toLowerCase() === "futures") {
                        var contractDetailValue = "FUT"
                    }
                    else if(productType.toLowerCase() === "options") {
                        var contractDetailValue = "OPT"
                    }
                    else {
                        self.subscribeException(exceptionMessage.PRODUCT_TYPE_EXCEPTION);
                    }

                    contractDetailValue = contractDetailValue + "-" + stockCode + "-" + expiryDate

                    if(productType.toLowerCase() === "options") {
                        if(strikePrice !== "") {
                            contractDetailValue = contractDetailValue + "-" + strikePrice;
                        }
                        else if(strikePrice === "" && productType.toLowerCase() === "options") {
                            self.subscribeException(exceptionMessage.STRIKE_PRICE_EXCEPTION);
                        }

                        if(right.toLowerCase() === "put") {
                            contractDetailValue = contractDetailValue + "-" + "PE";
                        }
                        else if(right.toLowerCase() === "call") {
                            contractDetailValue = contractDetailValue + "-" + "CE"
                        }
                        else if(productType.toLowerCase() === "options") {
                            self.subscribeException(exceptionMessage.RIGHT_EXCEPTION);
                        }
                    }
                    if(exchangeCode.toLowerCase() === "ndx") {
                        tokenValue = self.stockScriptDictList[2][contractDetailValue] || false;
                    }
                    else if(exchangeCode.toLowerCase() === "mcx") {
                        tokenValue = self.stockScriptDictList[3][contractDetailValue] || false;
                    }
                    else if(exchangeCode.toLowerCase() === "nfo") {
                        tokenValue = self.stockScriptDictList[4][contractDetailValue] || false;    
                    }
                    else if(exchangeCode.toLowerCase() === "bfo") {
                        tokenValue = self.stockScriptDictList[5][contractDetailValue] || false;
                    }
                }
                if(tokenValue === false) {
                    self.subscribeException(exceptionMessage.STOCK_INVALID_EXCEPTION);
                }
                var exchangeQuotesTokenValue = false;
                if(getExchangeQuotes !== false) {
                    exchangeQuotesTokenValue = exchangeCodeName + "1!" + tokenValue;
                }

                var marketDepthTokenValue = false;
                if(getMarketDepth !== false) {
                    marketDepthTokenValue = exchangeCodeName + "2!" + tokenValue;
                }
                return {"exch_quote_token":exchangeQuotesTokenValue,"market_depth_token": marketDepthTokenValue};

            }

        }
    }

    self.parseOhlcData = function(data){
        let splitData = data.split(",");
        let parsedData = {};
        if(Boolean(["NSE","BSE"].includes(splitData[0]))){
            parsedData = {
                "interval":feedIntervalMap[splitData[8]],
                "exchange_code":splitData[0],
                "stock_code":splitData[1],
                "low":splitData[2],
                "high":splitData[3],
                "open":splitData[4],
                "close":splitData[5],
                "volume":splitData[6],
                "datetime":splitData[7]
            }
        }
        else if(Boolean(["NFO","NDX","MCX","BFO"].includes(splitData[0]))){
            if(splitData.length == 13){
                parsedData = {
                    "interval":feedIntervalMap[splitData[12]],
                    "exchange_code":splitData[0],
                    "stock_code":splitData[1],
                    "expiry_date":splitData[2],
                    "strike_price":splitData[3],
                    "right_type":splitData[4],
                    "low":splitData[5],
                    "high":splitData[6],
                    "open":splitData[7],
                    "close":splitData[8],
                    "volume":splitData[9],
                    "oi":splitData[10],
                    "datetime":splitData[11]
                }
            }
            else{
                parsedData = {
                    "interval":feedIntervalMap[splitData[10]],
                    "exchange_code":splitData[0],
                    "stock_code":splitData[1],
                    "expiry_date":splitData[2],
                    "low":splitData[3],
                    "high":splitData[4],
                    "open":splitData[5],
                    "close":splitData[6],
                    "volume":splitData[7],
                    "oi":splitData[8],
                    "datetime":splitData[9]
                }
            }
        }
        return parsedData
    }

    self.parseMarketDepth = function(data, exchange){
        var depth = []
        var counter = 0;
        for(let lis of data){
            counter += 1;
            dict = {};
            if(exchange == '1'){
                dict["BestBuyRate-"+counter.toString()] = lis[0];
                dict["BestBuyQty-"+counter.toString()] = lis[1];
                dict["BestSellRate-"+counter.toString()] = lis[2];
                dict["BestSellQty-"+counter.toString()] = lis[3];
                depth.push(dict);
            }
            else{
                dict["BestBuyRate-"+counter.toString()] = lis[0];
                dict["BestBuyQty-"+counter.toString()] = lis[1];
                dict["BuyNoOfOrders-"+counter.toString()] = lis[2];
                dict["BuyFlag-"+counter.toString()] = lis[3];
                dict["BestSellRate-"+counter.toString()] = lis[4];
                dict["BestSellQty-"+counter.toString()] = lis[5];
                dict["SellNoOfOrders-"+counter.toString()] = lis[6];
                dict["SellFlag-"+counter.toString()] = lis[7];
                depth.push(dict);
            }
        }
        return depth;
    }

    self.parseStrategyData = function(data)
    {
        if(data !== null && data !== undefined && data.length == 28)
        {
            var strategy_dict = {}
            strategy_dict['strategy_date'] = data[0]
            strategy_dict['modification_date'] = data[1]
            strategy_dict['portfolio_id'] = data[2]
            strategy_dict['call_action'] = data[3]
            strategy_dict['portfolio_name'] = data[4]
            strategy_dict['exchange_code'] = data[5]
            strategy_dict['product_type'] = data[6]
            //strategy_dict['INDEX/STOCK'] = data[7]
            strategy_dict['underlying'] = data[8]
            strategy_dict['expiry_date'] = data[9]
            //strategy_dict['OCR_EXER_TYP'] = data[10]
            strategy_dict['option_type'] = data[11]
            strategy_dict['strike_price'] = data[12]
            strategy_dict['action'] = data[13]
            strategy_dict['recommended_price_from'] = data[14]
            strategy_dict['recommended_price_to'] = data[15]
            strategy_dict['minimum_lot_quantity'] = data[16]
            strategy_dict['last_traded_price'] = data[17]
            strategy_dict['best_bid_price'] = data[18]
            strategy_dict['best_offer_price'] = data[19]
            strategy_dict['last_traded_quantity'] = data[20]
            strategy_dict['target_price'] = data[21]           
            strategy_dict['expected_profit_per_lot'] = data[22]
            strategy_dict['stop_loss_price'] = data[23]
            strategy_dict['expected_loss_per_lot'] = data[24]
            strategy_dict['total_margin'] = data[25]
            strategy_dict['leg_no'] = data[26]
            strategy_dict['status'] = data[27]
            return(strategy_dict)
        }
        if(data !== null && data !== undefined && data.length == 19){
            var iclick_data = {}
            //iclick_data['sequence_number'] = data[0]
            iclick_data['stock_name'] = data[0]
            iclick_data['stock_code'] = data[1]
            iclick_data['action_type'] = data[2]
            iclick_data['expiry_date'] = data[3]
            iclick_data['strike_price'] = data[4]
            iclick_data['option_type'] = data[5]
            iclick_data['stock_description'] = data[6]
            iclick_data['recommended_price_and_date'] = data[7]
            iclick_data['recommended_price_from'] = data[8]
            iclick_data['recommended_price_to'] = data[9]
            iclick_data['recommended_date'] = data[10]
            iclick_data['target_price'] = data[11]
            iclick_data['sltp_price'] = data[12]
            iclick_data['part_profit_percentage'] = data[13]
            iclick_data['profit_price'] = data[14]
            iclick_data['exit_price'] = data[15]
            iclick_data['recommended_update'] = data[16]
            iclick_data['iclick_status'] = data[17]
            iclick_data['subscription_type'] = data[18]
            return(iclick_data)

        }
    }

    self.parseData = function(data){
        if(data !== null && data !== undefined && typeof(data[0]) !== String && data[0].indexOf('!') < 0){
            var order_dict = {}
            order_dict["sourceNumber"] = data[0]                            //Source Number
            order_dict["group"] = data[1]                                   //Group
            order_dict["userId"] = data[2]                                  //User_id
            order_dict["key"] = data[3]                                     //Key
            order_dict["messageLength"] = data[4]                           //Message Length
            order_dict["requestType"] = data[5]                             //Request Type
            order_dict["messageSequence"] = data[6]                         //Message Sequence
            order_dict["messageDate"] = data[7]                             //Date
            order_dict["messageTime"] = data[8]                             //Time
            order_dict["messageCategory"] = data[9]                         //Message Category
            order_dict["messagePriority"] = data[10]                        //Priority
            order_dict["messageType"] = data[11]                            //Message Type
            order_dict["orderMatchAccount"] = data[12]                      //Order Match Account
            order_dict["orderExchangeCode"] = data[13]                      //Exchange Code
            if(data[11] == '4' || data[11] == '5'){
                order_dict["stockCode"] = data[14]                     //Stock Code
                order_dict["orderFlow"] = self.tuxToUserValue['orderFlow'][data[15].toString().toUpperCase()] || data[15].toString()          // Order Flow
                order_dict["limitMarketFlag"] = self.tuxToUserValue['limitMarketFlag'][data[16].toString().toUpperCase()] || data[16].toString()             //Limit Market Flag
                order_dict["orderType"] = self.tuxToUserValue['orderType'][data[17].toString().toUpperCase()] || data[17].toString()                          //OrderType
                order_dict["orderLimitRate"] = data[18]                     //Limit Rate
                order_dict["productType"] = self.tuxToUserValue['productType'][data[19].toString().toUpperCase()] || data[19].toString()     //Product Type
                order_dict["orderStatus"] = self.tuxToUserValue['orderStatus'][data[20].toString().toUpperCase()] || data[20].toString()     // Order Status
                order_dict["orderDate"] = data[21]                          //Order  Date
                order_dict["orderTradeDate"] = data[22]                     //Trade Date
                order_dict["orderReference"] = data[23]                     //Order Reference
                order_dict["orderQuantity"] = data[24]                      //Order Quantity
                order_dict["openQuantity"] = data[25]                       //Open Quantity
                order_dict["orderExecutedQuantity"] = data[26]              //Order Executed Quantity
                order_dict["cancelledQuantity"] = data[27]                  //Cancelled Quantity
                order_dict["expiredQuantity"] = data[28]                    //Expired Quantity
                order_dict["orderDisclosedQuantity"] = data[29]             // Order Disclosed Quantity
                order_dict["orderStopLossTrigger"] = data[30]               //Order Stop Loss Triger
                order_dict["orderSquareFlag"] = data[31]                    //Order Square Flag
                order_dict["orderAmountBlocked"] = data[32]                 // Order Amount Blocked
                order_dict["orderPipeId"] = data[33]                        //Order PipeId
                order_dict["channel"] = data[34]                            //Channel
                order_dict["exchangeSegmentCode"] = data[35]                //Exchange Segment Code
                order_dict["exchangeSegmentSettlement"] = data[36]          //Exchange Segment Settlement 
                order_dict["segmentDescription"] = data[37]                 //Segment Description
                order_dict["marginSquareOffMode"] = data[38]                //Margin Square Off Mode
                order_dict["orderValidDate"] = data[40]                     //Order Valid Date
                order_dict["orderMessageCharacter"] = data[41]              //Order Message Character
                order_dict["averageExecutedRate"] = data[42]                //Average Exited Rate
                order_dict["orderPriceImprovementFlag"] = data[43]          //Order Price Flag
                order_dict["orderMBCFlag"] = data[44]                       //Order MBC Flag
                order_dict["orderLimitOffset"] = data[45]                   //Order Limit Offset
                order_dict["systemPartnerCode"] = data[46]                  //System Partner Code
            }
            else if(data[11] == '6' || data[11] == '7'){
                order_dict["stockCode"] = data[14]                         //stock code
                order_dict["productType"] =  self.tuxToUserValue['productType'][data[15].toString().toUpperCase()] || data[15].toString()   //Product Type
                order_dict["optionType"] = self.tuxToUserValue['optionType'][data[16].toString().toUpperCase()] || data[16].toString()      //Option T
                order_dict["exerciseType"] = data[17]                       //Exercise Type
                order_dict["strikePrice"] = data[18]                        //Strike Price
                order_dict["expiryDate"] = data[19]                         //Expiry Date
                order_dict["orderValidDate"] = data[20]                     //Order Valid Date
                order_dict["orderFlow"] = self.tuxToUserValue['orderFlow'][data[21].toString().toUpperCase()] || data[21].toString()                //Order  Flow
                order_dict["limitMarketFlag"] = self.tuxToUserValue['limitMarketFlag'][data[22].toString().toUpperCase()] || data[22].toString()     //Limit Market Flag
                order_dict["orderType"] = self.tuxToUserValue['orderType'][data[23].toString().toUpperCase()] || data[23].toString()                 //Order Type
                order_dict["limitRate"] = data[24]                          //Limit Rate
                order_dict["orderStatus"] = self.tuxToUserValue['orderStatus'][data[25].toString().toUpperCase()] || data[25].toString()              //Order Status
                order_dict["orderReference"] = data[26]                     //Order Reference
                order_dict["orderTotalQuantity"] = data[27]                 //Order Total Quantity
                order_dict["executedQuantity"] = data[28]                   //Executed Quantity
                order_dict["cancelledQuantity"] = data[29]                  //Cancelled Quantity
                order_dict["expiredQuantity"] = data[30]                    //Expired Quantity
                order_dict["stopLossTrigger"] = data[31]                    //Stop Loss Trigger
                order_dict["specialFlag"] = data[32]                        //Special Flag
                order_dict["pipeId"] = data[33]                             //PipeId
                order_dict["channel"] = data[34]                            //Channel
                order_dict["modificationOrCancelFlag"] = data[35]           //Modification or Cancel Flag
                order_dict["tradeDate"] = data[36]                          //Trade Date
                order_dict["acknowledgeNumber"] = data[37]                  //Acknowledgement Number
                order_dict["stopLossOrderReference"] = data[37]             //Stop Loss Order Reference
                order_dict["totalAmountBlocked"] = data[38]                 // Total Amount Blocked
                order_dict["averageExecutedRate"] = data[39]                //Average Executed Rate
                order_dict["cancelFlag"] = data[40]                         //Cancel Flag
                order_dict["squareOffMarket"] = data[41]                    //SquareOff Market
                order_dict["quickExitFlag"] = data[42]                      //Quick Exit Flag
                order_dict["stopValidTillDateFlag"] = data[43]              //Stop Valid till Date Flag
                order_dict["priceImprovementFlag"] = data[44]               //Price Improvement Flag
                order_dict["conversionImprovementFlag"] = data[45]          //Conversion Improvement Flag
                order_dict["trailUpdateCondition"] = data[45]               //Trail Update Condition
                order_dict["systemPartnerCode"] = data[46]                  //System Partner Code
            }
            return order_dict;
        }
        var exchange = data[0].split('!')[0].split('.')[0]
        var dataType = data[0].split('!')[0].split('.')[1];
        if(exchange == '6'){
            var dataDict = {};
            dataDict["Symbol"] = data[0];
            dataDict["AndiOPVolume"] = data[1];
            dataDict["Reserved"] = data[2];
            dataDict["IndexFlag"] = data[3];
            dataDict["ttq"] = data[4];
            dataDict["last"] = data[5];
            dataDict["ltq"] = data[6];
            dataDict["ltt"] = (new Date(data[7]*1000)).toString().replace(" GMT+0530 (India Standard Time)",'');
            dataDict["AvgTradedPrice"] = data[8];
            dataDict["TotalBuyQnt"] = data[9];
            dataDict["TotalSellQnt"] = data[10];
            dataDict["ReservedStr"] = data[11];
            dataDict["ClosePrice"] = data[12];
            dataDict["OpenPrice"] = data[13];
            dataDict["HighPrice"] = data[14];
            dataDict["LowPrice"] = data[15];
            dataDict["ReservedShort"] = data[16];
            dataDict["CurrOpenInterest"] = data[17];
            dataDict["TotalTrades"] = data[18];
            dataDict["HightestPriceEver"] = data[19];
            dataDict["LowestPriceEver"] = data[20];
            dataDict["TotalTradedValue"] = data[21];
            marketDepthIndex = 0
            let i=0;
            for(i=22;i<data.length;i++){
                dataDict["Quantity-"+marketDepthIndex.toString()] = data[i][0]
                dataDict["OrderPrice-"+marketDepthIndex.toString()] = data[i][1]
                dataDict["TotalOrders-"+marketDepthIndex.toString()] = data[i][2]
                dataDict["Reserved-"+marketDepthIndex.toString()] = data[i][3]
                dataDict["SellQuantity-"+marketDepthIndex.toString()] = data[i][4]
                dataDict["SellOrderPrice-"+marketDepthIndex.toString()] = data[i][5]
                dataDict["SellTotalOrders-"+marketDepthIndex.toString()] = data[i][6]
                dataDict["SellReserved-"+marketDepthIndex.toString()] = data[i][7]
                marketDepthIndex += 1
            }
        }
        else if(dataType == '1'){
            var dataDict = {
                "symbol": data[0],
                "open": data[1],
                "last": data[2],
                "high": data[3],
                "low": data[4],
                "change": data[5],
                "bPrice": data[6],
                "bQty": data[7],
                "sPrice": data[8],
                "sQty": data[9],
                "ltq": data[10],
                "avgPrice": data[11],
                "quotes": "Quotes Data"
            }
            // For NSE & BSE conversion
            if(data.length == 21){
                dataDict["ttq"] = data[12]
                dataDict["totalBuyQt"] = data[13]
                dataDict["totalSellQ"] = data[14]
                dataDict["ttv"] = data[15]
                dataDict["trend"] = data[16]
                dataDict["lowerCktLm"] = data[17]
                dataDict["upperCktLm"] = data[18]
                dataDict["ltt"] = (new Date(data[19]*1000)).toString().replace(" GMT+0530 (India Standard Time)",'')
                dataDict["close"] = data[20]
            }
            // For FONSE & CDNSE conversion
            else if(data.length == 23){
                dataDict["OI"] = data[12]
                dataDict["CHNGOI"] = data[13]
                dataDict["ttq"] = data[14]
                dataDict["totalBuyQt"] = data[15]
                dataDict["totalSellQ"] = data[16]
                dataDict["ttv"] = data[17]
                dataDict["trend"] = data[18]
                dataDict["lowerCktLm"] = data[19]
                dataDict["upperCktLm"] = data[20]
                dataDict["ltt"] = (new Date(data[21]*1000)).toString().replace(" GMT+0530 (India Standard Time)",'')
                dataDict["close"] = data[22]
            }
        }
        else{
            var dataDict = {
                "symbol": data[0],
                "time": (new Date(data[1]*1000)).toString().replace(" GMT+0530 (India Standard Time)",''),
                "depth": self.parseMarketDepth(data[2], exchange),
                "quotes": "Market Depth"
            }
        }
        if(exchange == '4' && data.length == 21)
            dataDict['exchange'] = 'NSE Equity'
        else if(exchange == '1')
            dataDict['exchange'] = 'BSE'
        else if(exchange == '13')
            dataDict['exchange'] = 'NSE Currency'
        else if(exchange == '4' && data.length == 23)
            dataDict['exchange'] = 'NSE Futures & Options'
        else if(exchange == '6')
            dataDict['exchange'] = 'Commodity'
        return dataDict
    }

    self.getContractName = function(underlying, productType, expiryDate, strikePrice, optionType) {
        try {
            productType = (productType || '').replace(/"/g, '').toUpperCase();
            underlying = (underlying || '').replace(/"/g, '');
            expiryDate = (expiryDate || '').replace(/"/g, '');
            strikePrice = (strikePrice || '').replace(/"/g, '');
            optionType = (optionType || '').replace(/"/g, '').toUpperCase();


            if (productType.includes('FUT')) {
            // FUT-<underlying>-<expiry>
            return `FUT-${underlying}-${expiryDate}`;
            } else {
            const right = optionType.includes('C') ? 'CE' : 'PE';
            return `OPT-${underlying}-${expiryDate}-${strikePrice}-${right}`;
            }
        } catch (err) {
            return '';
        }
        }

    self.getStockScriptList= async function(){
        self.stockScriptDictList = [{}, {}, {}, {}, {}, {}];
        self.tokenScriptDictList = [{}, {}, {}, {}, {}, {}];
        try {
            const resp = await axios.get(urls.SECURITY_MASTER_URL, { responseType: 'arraybuffer', timeout: 60000 });
            const zip = new AdmZip(Buffer.from(resp.data));
            const entries = zip.getEntries();

            for (const entry of entries) {
                    const fileName = entry.entryName;
                    if (!fileName.toLowerCase().endsWith('.txt')) continue;

                    const fUpper = fileName.toUpperCase();
                    let exchangeCode = null;
                    let idx = null;

                    if (fUpper.includes('FONSE')) { exchangeCode = 'NFO'; idx = 4; }
                    else if (fUpper.includes('FOBSE')) { exchangeCode = 'BFO'; idx = 5; }
                    else if (fUpper.includes('MCX')) { exchangeCode = 'MCX'; idx = 3; }
                    else if (fUpper.includes('NDX')) { exchangeCode = 'NDX'; idx = 2; }
                    else if (fUpper.includes('NSE')) { exchangeCode = 'NSE'; idx = 1; }
                    else if (fUpper.includes('BSE')) { exchangeCode = 'BSE'; idx = 0; }
                    else continue;

                    const raw = entry.getData().toString('utf8').replace(/\r/g, '');
                    const rows = parse(raw, {
                        relax_column_count: true,
                        skip_empty_lines: true,
                        relax_quotes: true,
                });
                for (const columns of rows) {
                    if (!columns || columns.length < 5) continue;

                    if (exchangeCode === 'BSE' || exchangeCode === 'NSE') {
                        const token = (columns[0] || '').replace(/"/g, '').trim();
                        const stockCode = ((columns[1] && columns[1].replace(/"/g,'')) || (columns[3] && columns[3].replace(/"/g,'')) || '').trim();
                        const companyName = (columns[3] || '').replace(/"/g, '').trim();
                        self.stockScriptDictList[idx][stockCode] = token;
                        self.tokenScriptDictList[idx][token] = [stockCode, companyName];
                    } 
                    else if (exchangeCode === 'NFO' || exchangeCode === 'BFO') {
                        const underlying = (columns[2] || '').replace(/"/g, '').trim();
                        const productType = (columns[3] || '').replace(/"/g, '').trim();
                        const expiry = (columns[4] || '').replace(/"/g, '').trim();
                        const strike = (columns[5] || '').replace(/"/g, '').trim();
                        const optType = (columns[6] || '').replace(/"/g, '').trim();
                        const contractName = self.getContractName(underlying, productType, expiry, strike, optType);
                        const token = (columns[0] || '').replace(/"/g, '').trim();
                        const companyName = (columns.length > 29 ? (columns[29] || '') : '').replace(/"/g, '').trim();
                        self.stockScriptDictList[idx][contractName] = token;
                        self.tokenScriptDictList[idx][token] = [contractName, companyName];
                    } 
                    else if (exchangeCode === 'MCX') {
                        // const underlying = columns[2] || '';
                        // const productType = columns[3] || '';
                        // const expiry = columns[7] || '';
                        // const optType = columns[8] || '';
                        // const strike = columns[9] || '';
                        const contractName = self.getContractName(columns[2], columns[3], columns[7], columns[8], columns[9]);
                        const token = (columns[0] || '').replace(/"/g, '').trim();
                        const companyName = (columns[4] || '').replace(/"/g, '').trim();
                        self.stockScriptDictList[idx][contractName] = token;
                        self.tokenScriptDictList[idx][token] = [contractName, companyName];
                    } 
                    else if (exchangeCode === 'NDX') {
                        const token = (columns[0] || '').replace(/"/g, '').trim();
                        const stockCode = (columns[2] || '').replace(/"/g, '').trim();
                        const companyName = (columns.length > 29 ? (columns[29] || '') : '').replace(/"/g, '').trim();
                        self.stockScriptDictList[idx][stockCode] = token;
                        self.tokenScriptDictList[idx][token] = [stockCode, companyName];
                     }
                } 
            }
            return self.stockScriptDictList,
                    self.tokenScriptDictList;

        } catch(error){
            throw error.toString();
        }
        }

    self.subscribeFeeds = async function({stockToken="", exchangeCode="", stockCode="", productType="", expiryDate="", strikePrice="", right="", getExchangeQuotes=true, getMarketDepth=true, getOrderNotification=false,interval=""}){
        if(interval != ""){
            if(!Boolean(typeList.INTERVAL_TYPES_STREAM_OHLC.includes(interval.toLowerCase())))
                self.socketConnectionResponse(exceptionMessage.STREAM_OHLC_INTERVAL_ERROR);
            else
                interval = channelIntervalMap[interval];
        }
        if(self.socket){
            var return_object = {}
            if(getOrderNotification == true){
                self.wsConnectOrder();
                self.notify()
                return_object = self.socketConnectionResponse(responseMessage.ORDER_NOTIFICATION_SUBSCRIBED)
            }

            if(stockToken === roomName.ONE_CLICK_ROOM || stockToken === roomName.I_CLICK_2_GAIN)
            {
                if(self.socketOrder == null)
                {
                    self.connect({isOrder:true}); //for strategy streaming order socket would be used ie livefeeds.icicidirect.com
                }
                self.watchStrategy(stockToken);
                return_object = self.socketConnectionResponse(responseMessage.ONE_CLICK_STRATEGY_SUBSCRIBED);
                return return_object;
            }

            if(stockToken != ""){
                if(interval!=""){
                    if(self.socketOHLCV==null){
                        self.connect({isOHLCV:true})
                    }
                    self.watchStreamData(stockToken,interval)
                }
                else
                    self.watch(stockToken)
                return_object = self.socketConnectionResponse(responseMessage.STOCK_SUBSCRIBE_MESSAGE.format(stockToken));
            }
            else if(getOrderNotification == true && exchangeCode == ""){
                return return_object
            }
            else{
                var tokenDict = self.getStockTokenValue({exchangeCode:exchangeCode, stockCode:stockCode, productType:productType, expiryDate:expiryDate, strikePrice:strikePrice, right:right, getExchangeQuotes:getExchangeQuotes, getMarketDepth:getMarketDepth, interval:interval});
                if(interval!=""){
                    if(self.socketOHLCV==null){
                        self.connect({isOHLCV:true});
                    }
                    self.watchStreamData(tokenDict["exch_quote_token"],interval);
                }
                else{
                    if(tokenDict["exch_quote_token"] != false)
                        self.watch(tokenDict["exch_quote_token"]);
                    if( tokenDict["market_depth_token"] != false)
                        self.watch(tokenDict["market_depth_token"]);
                }
                return_object = self.socketConnectionResponse(responseMessage.STOCK_SUBSCRIBE_MESSAGE.format(stockCode));
            }
            return return_object
        }
    }

    self.unsubscribeFeeds = async function({stockToken="", exchangeCode="", stockCode="", productType="", expiryDate="", strikePrice="", right="", interval="",getExchangeQuotes=true, getMarketDepth=true, getOrderNotification=false}){
        if(interval != ""){
            if(!Boolean(typeList.INTERVAL_TYPES_STREAM_OHLC.includes(interval.toLowerCase())))
                self.socketConnectionResponse(exceptionMessage.STREAM_OHLC_INTERVAL_ERROR);
            else
                interval = channelIntervalMap[interval];
        }
        if(getOrderNotification==true)
        {
            if(self.socketOrder)
            {
                self.socketOrder = null;
                return self.socketConnectionResponse(responseMessage.ORDER_REFRESH_DISCONNECTED);
            }
            else{
                return self.socketConnectionResponse(responseMessage.ORDER_REFRESH_NOT_CONNECTED);
            }
        }
        if(stockToken === "one_click_fno")
        {
            if(self.socketOrder)
            {
                self.socketOrder.unwatchStrategy(stockToken);
            }
            return self.socketConnectionResponse(responseMessage.ONE_CLICK_STRATEGY_UNSUBSCRIBED);
        }
        
        else if(self.socket){
            if(stockToken!=""){
                if(interval!="")
                    self.unwatchStreamData(stockToken);
                else
                    self.unwatch(stockToken);
                return self.socketConnectionResponse(responseMessage.STOCK_UNSUBSCRIBE_MESSAGE.format(stockToken));
            }
            else{
                var tokenDict = self.getStockTokenValue({exchangeCode:exchangeCode, stockCode:stockCode, productType:productType, expiryDate:expiryDate, strikePrice:strikePrice, right:right, getExchangeQuotes:getExchangeQuotes, getMarketDepth:getMarketDepth, interval:interval})
                if(interval!="")
                    self.unwatchStreamData(stockToken["exch_quote_token"],interval);
                else{
                    if(tokenDict["exch_quote_token"] != false)
                        self.unwatch(tokenDict["exch_quote_token"])
                    if( tokenDict["market_depth_token"] != false)
                        self.unwatch(tokenDict["market_depth_token"])
                }
                return self.socketConnectionResponse(responseMessage.STOCK_UNSUBSCRIBE_MESSAGE.format(stockCode));
            }
        }
    }

    self.generateHeaders = function(body) {
        try {
            var currentDate = new Date().toISOString().split(".")[0] + '.000Z';
            let checksum = sha256(currentDate+JSON.stringify(body)+self.secretKey);
            headers = {
                "Content-Type": "application/json",
                'X-Checksum': "token "+checksum,
                'X-Timestamp': currentDate,
                'X-AppKey': self.appKey,
                'X-SessionToken': self.apiSession
            }
            return headers;
        } catch (error) {
            self.errorException("generateHeaders", error);
        }
    };

    self.makeRequest = async function(method, endpoint, body, header) {
        try {

            let url = urls.API_URL + endpoint;
            let res = null;

            if(method === apiRequest.GET) {
                res = await axios(
                        {
                            method:'get',
                            url:url,
                            data:body,
                            headers:header
                        }
                        ).then((resp)=>{return resp})
                return res;
            }
            else if(method === apiRequest.POST) {
                res = await axios.post(url=url, data=body, {headers:header})
                        .then((resp)=>{return resp});
                return res;
            }
            else if(method === apiRequest.PUT) {
                res = axios.put(url=url, data=body, {headers:header})
                    .then((resp)=>{return resp});
                return res;
            }
            else if(method === apiRequest.DELETE) {
                res = axios.delete(url=url, data=body, {headers:header})
                    .then((resp)=>{return resp});
                return res;
            }
        } catch (error) {
            self.errorException(exceptionMessage.API_REQUEST_EXCEPTION.format(method,url), error);
        }
    };


    self.getCustomerDetails = async function(session_token="") {
        try {
            let response = self.validationErrorResponse("");
            if(session_token === "" || session_token === null) {
                return self.validationErrorResponse(responseMessage.API_SESSION_ERROR);
            }
            headers = {
                "Content-Type": "application/json"
            }
            body = {
                "SessionToken": session_token,
                "AppKey": self.appKey,
            }
            response = await self.makeRequest(apiRequest.GET, apiEndpoint.CUST_DETAILS, body, headers);
            delete response.data['Success']['session_token'];
            return(response.data);
           
        } catch (error) {
            self.errorException("getCustomerDetails", error);
        }
    };

    self.getDematHoldings = async function() {
        try {
            let body = {}
            headers = self.generateHeaders(body);
            let response = await self.makeRequest(apiRequest.GET, apiEndpoint.DEMAT_HOLDING, body, headers);
            return response.data;
        } catch (error) {
            self.errorException("getDematHoldings", error);
        }
    };  

    self.getFunds = async function() {
        try {
            let body = {}
            headers = self.generateHeaders(body);
            let response = await self.makeRequest(apiRequest.GET, apiEndpoint.FUND, body, headers);
            return response.data;
        } catch (error) {
            self.errorException("getFunds", error);
        }
    };

    self.setFunds = async function({transactionType="", amount="", segment=""}) {
        try {
            if(transactionType === "" || transactionType === null || amount === "" || amount === null || segment === "" || segment === null) {
                if(transactionType === "" || transactionType === null) {
                    return self.validationErrorResponse(responseMessage.BLANK_TRANSACTION_TYPE);
                }
                else if(amount === "" || amount === null) {
                    return self.validationErrorResponse(responseMessage.BLANK_AMOUNT);
                }
                else if(segment === "" || segment === null) {
                    return self.validationErrorResponse(responseMessage.BLANK_SEGMENT);
                }
            }
            else if(transactionType.toLowerCase() !=="debit" && transactionType.toLowerCase() !== "credit") {
                return self.validationErrorResponse(responseMessage.TRANSACTION_TYPE_ERROR);
            }
            else if(parseInt(amount) <= 0) {
                return self.validationErrorResponse(responseMessage.ZERO_AMOUNT_ERROR);
            }
            let body = {
                "transaction_type": transactionType,
                "amount": amount,
                "segment": segment
            }
            let headers = self.generateHeaders(body);
            let response = await self.makeRequest(apiRequest.POST, apiEndpoint.FUND, body, headers);
            return response.data;
        } catch (error) {
            self.errorException("setFunds", error);
        }
    };

    self.getHistoricalData = async function({interval="", fromDate="", toDate="", stockCode="", exchangeCode="", productType="", expiryDate="", right="", strikePrice=""}) {
        try {
            if(interval === "" || interval === null) {
                return self.validationErrorResponse(responseMessage.BLANK_INTERVAL);
            }
            else if(!Boolean(typeList.INTERVAL_TYPES.includes(interval.toLowerCase()))) {
                return self.validationErrorResponse(responseMessage.INTERVAL_TYPE_ERROR);
            }
            else if(exchangeCode === "" || exchangeCode === null) {
                return self.validationErrorResponse(responseMessage.BLANK_EXCHANGE_CODE);
            }
            else if(exchangeCode.toLowerCase() !== "nse" && exchangeCode.toLowerCase() !== "nfo" && exchangeCode.toLowerCase() !== "bse") {
                return self.validationErrorResponse(responseMessage.EXCHANGE_CODE_ERROR);
            }
            else if(fromDate === "" || fromDate === null) {
                return self.validationErrorResponse(responseMessage.BLANK_FROM_DATE);
            }
            else if(toDate === "" || toDate === null) {
                return self.validationErrorResponse(responseMessage.BLANK_TO_DATE);
            }
            else if(stockCode === "" || stockCode === null) {
                return self.validationErrorResponse(responseMessage.BLANK_STOCK_CODE);
            }
            else if(exchangeCode.toLowerCase() === "nfo" || exchangeCode.toLowerCase() === "bfo") {
                if(productType === "" || productType === null) {
                      return self.validationErrorResponse(responseMessage.BLANK_PRODUCT_TYPE_NFO_BFO);
                }
                else if(!Boolean(typeList.PRODUCT_TYPES_HIST.includes(productType.toLowerCase()))) {
                    return self.validationErrorResponse(responseMessage.PRODUCT_TYPE_ERROR);
                }
                else if(productType.toLowerCase() === "options" && (strikePrice === "" || strikePrice === null)) {
                    return self.validationErrorResponse(responseMessage.BLANK_STRIKE_PRICE);
                }
                else if(expiryDate === "" || expiryDate === null) {
                    return self.validationErrorResponse(responseMessage.BLANK_EXPIRY_DATE);
                }
            }
            if(interval === "1minute") {
                interval = "minute";
            }
            else if(interval === "1day") {
                interval = "day";
            }

            let body = {
                "interval": interval,
                "from_date": fromDate,
                "to_date": toDate,
                "stock_code": stockCode,
                "exchange_code": exchangeCode
            }

            if(productType !== "" && productType !== null) {
                body["product_type"] = productType;
            }
            if(expiryDate !== "" && expiryDate !== null) {
                body["expiry_date"] = expiryDate;
            }
            if(strikePrice !== "" && strikePrice !== null) {
                body["strike_price"] = strikePrice;
            }
            if(right != "" && right !== null){
                body["right"] = right
            }
            let headers = self.generateHeaders(body);
            let response = await self.makeRequest(
                apiRequest.GET, apiEndpoint.HIST_CHART, body, headers);
            return response.data;
        } catch (error) {
            self.errorException("getHistoricalData",error);
        }
    }

    self.getHistoricalDatav2 = async function({interval="", fromDate="", toDate="", stockCode="", exchangeCode="", productType="", expiryDate="", right="", strikePrice=""}) {
        try {
            if(interval === "" || interval === null) {
                return self.validationErrorResponse(responseMessage.BLANK_INTERVAL);
            }
            else if(!Boolean(typeList.INTERVAL_TYPES_HIST_V2.includes(interval.toLowerCase()))) {
                return self.validationErrorResponse(responseMessage.INTERVAL_TYPE_ERROR_HIST_V2);
            }
            else if(exchangeCode === "" || exchangeCode === null) {
                return self.validationErrorResponse(responseMessage.BLANK_EXCHANGE_CODE);
            }
            else if(!Boolean(typeList.EXCHANGE_CODES_HIST_V2.includes(exchangeCode.toLowerCase()))) {
                return self.validationErrorResponse(responseMessage.EXCHANGE_CODE_HIST_V2_ERROR);
            }
            else if(fromDate === "" || fromDate === null) {
                return self.validationErrorResponse(responseMessage.BLANK_FROM_DATE);
            }
            else if(toDate === "" || toDate === null) {
                return self.validationErrorResponse(responseMessage.BLANK_TO_DATE);
            }
            else if(stockCode === "" || stockCode === null) {
                return self.validationErrorResponse(responseMessage.BLANK_STOCK_CODE);
            }
            else if(Boolean(typeList.DERI_EXCH_CODES.includes(exchangeCode.toLowerCase()))) {
                if(productType === "" || productType === null) {
                    return self.validationErrorResponse(responseMessage.BLANK_PRODUCT_TYPE_HIST_V2);
                }
                else if(!Boolean(typeList.PRODUCT_TYPES_HIST.includes(productType.toLowerCase()))) {
                    return self.validationErrorResponse(responseMessage.PRODUCT_TYPE_ERROR_HIST_V2);
                }
                else if(productType.toLowerCase() === "options" && (strikePrice === "" || strikePrice === null)) {
                    return self.validationErrorResponse(responseMessage.BLANK_STRIKE_PRICE);
                }
                else if(expiryDate === "" || expiryDate === null) {
                    return self.validationErrorResponse(responseMessage.BLANK_EXPIRY_DATE);
                }
            }

            let url_params = {
                "interval": interval,
                "from_date": fromDate,
                "to_date": toDate,
                "stock_code": stockCode,
                "exch_code": exchangeCode
            }

            if(productType !== "" && productType !== null) {
                url_params["product_type"] = productType;
            }
            if(expiryDate !== "" && expiryDate !== null) {
                url_params["expiry_date"] = expiryDate;
            }
            if(strikePrice !== "" && strikePrice !== null) {
                url_params["strike_price"] = strikePrice;
            }
            if(right != "" && right !== null){
                url_params["right"] = right
            }
            let headers = {
                "Content-Type": "application/json",
                'X-SessionToken':self.apiSession,
                'apikey':self.appKey
            }
            let response = await axios.get(urls.BREEZE_NEW_URL+apiEndpoint.HIST_CHART,{
                params:url_params, headers:headers
            })
            return response.data;
        } catch (error) {
            self.errorException("getHistoricalData",error);
        }
    }

    self.addMargin = async function({productType="", stockCode="", exchangeCode="", settlementId="", addAmount="", marginAmount="", openQuantity="", coverQuantity="", categoryIndexPerStock="", expiryDate="", right="", contractTag="", strikePrice="", segmentCode=""}) {
        try {
            if(exchangeCode === "" || exchangeCode === null) {
                return self.validationErrorResponse(responseMessage.BLANK_EXCHANGE_CODE);
            }
            else if(productType !== "" && productType !== null && !Boolean(typeList.PRODUCT_TYPES.includes(productType.toLowerCase()))) {
                return self.validationErrorResponse(responseMessage.PRODUCT_TYPE_ERROR);
            }
            else if(right !== "" && right !== null && !Boolean(typeList.RIGHT_TYPES.includes(right.toLowerCase()))) {
                return self.validationErrorResponse(responseMessage.RIGHT_TYPE_ERROR);
            }
            let body = {
                "exchange_code": exchangeCode
            }

            if (productType !== "" && productType !== null) {
                body["product_type"] = productType;
            }
            if(stockCode !== "" && stockCode !== null) {
                body["stock_code"] = stockCode;
            }
            if(coverQuantity !== "" && coverQuantity !== null) {
                body["cover_quantity"] = coverQuantity;
            }
            if(categoryIndexPerStock != "" && categoryIndexPerStock !== null){
                body["category_index_per_stock"] = categoryIndexPerStock;
            }
            if(contractTag != "" && contractTag !== null){
                body["contract_tag"] = contractTag
            }
            if(marginAmount !== "" && marginAmount !== null) {
                body["margin_amount"] = marginAmount;
            }
            if(expiryDate !== "" && expiryDate !== null) {
                body["expiry_date"] = expiryDate;
            }
            if(right != "" && right !== null){
                body["right"] = right;
            }
            if(strikePrice != "" && strikePrice !== null){
                body["strike_price"] = strikePrice;
            }
            if(segmentCode != "" && segmentCode !== null){
                body["segment_code"] = segmentCode;
            }
            if(settlementId != "" && settlementId !== null){
                body["settlement_id"] = settlementId;
            }
            if(addAmount != "" && addAmount !== null){
                body["add_amount"] = addAmount;
            }
            if(openQuantity != "" && openQuantity !== null){
                body["open_quantity"] = openQuantity;
            }
            let headers = self.generateHeaders(body);
            let response = await self.makeRequest(apiRequest.POST, apiEndpoint.MARGIN, body, headers);
            return response.data;
        } catch (error) {
            self.errorException("addMargin",error);
        }
    };

    self.getMargin = async function(exchangeCode="") {
        try {
            if(exchangeCode === "" || exchangeCode === null) {
                return self.validationErrorResponse(responseMessage.BLANK_EXCHANGE_CODE);
            }
            let body = {
                "exchange_code": exchangeCode
            }
            let headers = self.generateHeaders(body);
            let response = await self.makeRequest(apiRequest.GET, apiEndpoint.MARGIN, body, headers);
            return response.data;
        } catch (error) {
            self.errorException("getMargin",error);
        }
    };

    self.placeOrder = async function({stockCode="", exchangeCode="", product="", action="", orderType="", stoploss="", quantity="", price="", validity="", validityDate="", disclosedQuantity="", expiryDate="", right="", strikePrice="", userRemark="", orderTypeFresh = "", orderRateFresh = "",settlementId = "",orderSegmentCode = ""}) {
        try {
            if(stockCode === "" || stockCode === null || exchangeCode === "" || exchangeCode === null || product === "" || product === null || action === "" || action === null || orderType === "" || orderType === null || quantity === "" || quantity === null || price === "" || price === null || action === "" || action == null) {
                if(stockCode === "" || stockCode === null) {
                    return self.validationErrorResponse(responseMessage.BLANK_STOCK_CODE);
                }
                else if(exchangeCode === "" || exchangeCode === null) {
                    return self.validationErrorResponse(responseMessage.BLANK_EXCHANGE_CODE);
                }
                else if(product === "" || product === null) {
                    return self.validationErrorResponse(responseMessage.BLANK_PRODUCT_TYPE);
                }
                else if(action === "" || action === null) {
                    return self.validationErrorResponse(responseMessage.BLANK_ACTION);
                }
                else if(orderType === "" || orderType === null) {
                    return self.validationErrorResponse(responseMessage.BLANK_ORDER_TYPE);
                }
                else if(quantity === "" || quantity === null) {
                    return self.validationErrorResponse(responseMessage.BLANK_QUANTITY);
                }
                else if(validity === "" || validity === null) {
                    return self.validationErrorResponse(responseMessage.BLANK_VALIDITY);
                }
            }
            else if(!Boolean(typeList.PRODUCT_TYPES.includes(product.toLowerCase()))) {
                return self.validationErrorResponse(responseMessage.PRODUCT_TYPE_ERROR);
            }
            else if(action.toLowerCase() !== "buy" && action.toLowerCase() !== "sell") {
                return self.validationErrorResponse(responseMessage.ACTION_TYPE_ERROR);
            }
            else if(orderType.toLowerCase() !== "limit" && orderType.toLowerCase() !== "market" && orderType.toLowerCase() !== "stoploss") {
                return self.validationErrorResponse(responseMessage.ORDER_TYPE_ERROR);
            }
            else if(validity.toLowerCase() !== "day" && validity.toLowerCase() !== "ioc" && validity.toLowerCase() !== "vtc") {
                return self.validationErrorResponse(responseMessage.VALIDITY_TYPE_ERROR);
            }
            else if(right !== "" && right !== null && (right.toLowerCase() !== "put" && right.toLowerCase() !== "call" && right.toLowerCase() !== "others")) {
                return self.validationErrorResponse(responseMessage.RIGHT_TYPE_ERROR);
            }

            let body = {
                "stock_code": stockCode,
                "exchange_code": exchangeCode,
                "product": product,
                "action": action,
                "order_type": orderType,
                "quantity": quantity,
                "price": price,
                "validity": validity,
                "order_segment_code" : orderSegmentCode,
                "settlement_id" : settlementId
            };

            if(stoploss !== "" && stoploss !== null) {
                body["stoploss"] = stoploss;
            }
            if(validityDate !== "" && validityDate !== null) {
                body["validity_date"] = validityDate;
            }
            if(disclosedQuantity !== "" && disclosedQuantity !== null) {
                body["disclosed_quantity"] = disclosedQuantity;
            }
            if(expiryDate !== "" && expiryDate !== null) {
                body["expiry_date"] = expiryDate;
            }
            if(right !== "" && right !== null) {
                body["right"] = right;
            }
            if(strikePrice !== "" && strikePrice !== null) {
                body["strike_price"] = strikePrice;
            }
            if(userRemark !== "" && userRemark !== null) {
                body["user_remark"] = userRemark;
            }
            if(orderRateFresh !=="" && orderRateFresh !== null)
            {
                body["order_rate_fresh"] = orderRateFresh;
            }
            if(orderTypeFresh !== "" && orderTypeFresh !== null)
            {
                body["order_type_fresh"] = orderTypeFresh;
            }
            let headers = self.generateHeaders(body);
            let response = await self.makeRequest(apiRequest.POST, apiEndpoint.ORDER, body, headers);
            return response.data;
        } catch (error) {
            self.errorException("placeOrder",error);
        }
    };

    self.getOrderDetail = async function({exchangeCode="", orderId="" }) {
        try {
            if(exchangeCode === "" && exchangeCode === null && orderId === "" && orderId === null) {
                if(exchangeCode === "" && exchangeCode === null) {
                    return self.validationErrorResponse(responseMessage.BLANK_EXCHANGE_CODE);
                }
                else if(orderId === "" && orderId === null) {
                    return self.validationErrorResponse(responseMessage.BLANK_ORDER_ID);
                }
            }
            let body = {
                "exchange_code": exchangeCode,
                "order_id": orderId
            }

            let headers = self.generateHeaders(body);
            let response = await self.makeRequest(apiRequest.GET, apiEndpoint.ORDER, body, headers);
            return response.data;
        } catch (error) {
            self.errorException("getOrderDetail",error);
        }
    };

    self.getOrderList = async function({exchangeCode = "", fromDate = "", toDate = ""}) {
        try {
            if(exchangeCode === "" || exchangeCode === null || fromDate === "" || fromDate === null || toDate === "" || toDate === null) {
                if(exchangeCode === "" || exchangeCode === null) {
                    return self.validationErrorResponse(responseMessage.BLANK_EXCHANGE_CODE);
                }
                else if(fromDate === "" || fromDate === null) {
                    return self.validationErrorResponse(responseMessage.BLANK_FROM_DATE);
                }
                else if(toDate === "" || toDate === null) {
                    return self.validationErrorResponse(responseMessage.BLANK_TO_DATE);
                }
            }
            let body = {
                "exchange_code": exchangeCode,
                "from_date": fromDate,
                "to_date": toDate
            };

            let headers = self.generateHeaders(body)
            let response = await self.makeRequest(apiRequest.GET, apiEndpoint.ORDER, body, headers);
            return response.data;
        } catch (error) {
            self.errorException("getOrderList",error);
        }
    };

    self.cancelOrder = async function({exchangeCode = "", orderId = ""}) {
        try {
            if(exchangeCode === "" || exchangeCode === null && orderId === "" || orderId === null) {
                if(exchangeCode === "" || exchangeCode === null) {
                    return self.validationErrorResponse(responseMessage.BLANK_EXCHANGE_CODE);
                }
                else if(orderId === "" || orderId === null) {
                    return self.validationErrorResponse(responseMessage.BLANK_ORDER_ID);
                }
            }
            let body = {
                "exchange_code": exchangeCode,
                "order_id": orderId
            };

            let headers = self.generateHeaders(body)
            let response = await self.makeRequest(apiRequest.DELETE, apiEndpoint.ORDER, body, headers)
            return response.data;
        } catch (error) {
            self.errorException("cancelOrder",error);
        }
    };

    self.modifyOrder = async function({orderId = "", exchangeCode = "", orderType = "", stoploss = "", quantity = "", price = "", validity = "", disclosedQuantity = "", validityDate = ""}) {
        try {
            if(exchangeCode === "" || exchangeCode === null || orderId === "" || orderId === null) {
                if(exchangeCode === "" || exchangeCode === null) {
                    return self.validationErrorResponse(responseMessage.BLANK_EXCHANGE_CODE);
                }
                else if(order_id === "" || order_id === null) {
                    return self.validationErrorResponse(responseMessage.BLANK_ORDER_ID);
                }
            }
            else if(orderType !== "" && orderType !== null && !Boolean(typeList.ORDER_TYPES.includes(order_type.toLowerCase()))) {
                return self.validationErrorResponse(responseMessage.BLANK_ORDER_TYPE);
            }
            else if(validity !== "" && validity !== null && !Boolean(typeList.VALIDITY_TYPES.includes(validity.toLowerCase()))) {
                return self.validationErrorResponse(responseMessage.ORDER_TYPE_ERROR);
            }
            let body = {
                "order_id": order_id,
                "exchange_code": exchangeCode,
            }

            if(orderType !== "" && orderType !== null) {
                body["order_type"] = orderType;
            }
            if(stoploss !== "" && stoploss !== null) {
                body["stoploss"] = stoploss;
            }
            if(quantity !== "" && quantity !== null) {
                body["quantity"] = quantity;
            }
            if(price !== "" && price !== null) {
                body["price"] = price;
            }
            if(validity !== "" && validity !== null) {
                body["validity"] = validity;
            }
            if(disclosedQuantity !== "" && disclosedQuantity !== null) {
                body["disclosed_quantity"] = disclosedQuantity;
            }
            if(validityDate !== "" && validityDate !== null) {
                body["validity_date"] = validityDate;
            }
            let headers = self.generateHeaders(body);
            let response = await self.makeRequest(apiRequest.PUT, apiEndpoint.ORDER, body, headers);
            return response.data;
        } catch (error) {
            self.errorException("modifyOrder",error);
        }
    };

    self.getPortfolioHoldings = async function({exchangeCode = "", fromDate = "", toDate = "",stockCode = "", portfolioType = ""}) {
        try {
            if(exchangeCode === "" || exchangeCode === null) {
                return self.validationErrorResponse(responseMessage.BLANK_EXCHANGE_CODE);
            }
            let body = {
                "exchange_code": exchangeCode,
            };
            if(fromDate !== "" && fromDate !== null){
                body["from_date"] = fromDate
            }
            if(toDate !== "" && toDate !== null){
                body["to_date"] = toDate
            }
            if(stockCode != "" && stockCode !== null){
                body["stock_code"] = stockCode
            }
            if(portfolioType !== "" && portfolioType !== null){
                body["portfolio_type"] = portfolioType
            }
            let headers = self.generateHeaders(body)
            let response = await self.makeRequest(
                apiRequest.GET,apiEndpoint.PORTFOLIO_HOLDING, body, headers)
            return response.data;
        } catch (error) {
            self.errorException("getPortfolioHoldings",error);
        }
    };

    self.getPortfolioPositions = async function() {
        try {
            let body = {};
            let headers = self.generateHeaders(body);
            let response = await self.makeRequest(
                apiRequest.GET, apiEndpoint.PORTFOLIO_POSITION, body, headers);
            return response.data;
        } catch (error) {
            self.errorException("getPortfolioPositions",error);
        }
    };

    self.getQuotes = async function({stockCode = "", exchangeCode = "", expiryDate = "", productType = "", right = "", strikePrice = ""}) {
        try {
            if(exchangeCode === "" || exchangeCode === null || stockCode === "" || stockCode === null) {
                if(exchangeCode === "" || exchangeCode === null) {
                    return self.validationErrorResponse(responseMessage.BLANK_EXCHANGE_CODE);
                }
                if(stockCode === "" || stockCode === null) {
                    return self.validationErrorResponse(responseMessage.BLANK_STOCK_CODE);
                }
            }
            else if(productType !== "" && productType !== null && !Boolean(typeList.PRODUCT_TYPES.includes(productType.toLowerCase()))) {
                return self.validationErrorResponse(responseMessage.PRODUCT_TYPE_ERROR);
            }
            else if(right !== "" && right !== null && !Boolean(typeList.RIGHT_TYPES.includes(right.toLowerCase()))) {
                return self.validationErrorResponse(responseMessage.RIGHT_TYPE_ERROR);
            }
            let body = {
                "stock_code": stockCode,
                "exchange_code": exchangeCode
            };

            if(expiryDate !== "" && expiryDate !== null) {
                body["expiry_date"] = expiryDate
            }
            if(productType !== "" && productType !== null) {
                body["product_type"] = productType
            }
            if(right !== "" && right !== null) {
                body["right"] = right
            }
            if(strikePrice !== "" && strikePrice !== null) {
                body["strike_price"] = strikePrice
            }
            let headers = self.generateHeaders(body);
            let response = await self.makeRequest(apiRequest.GET,apiEndpoint.QUOTE, body, headers);
            return response.data;
        } catch (error) {
            self.errorException("getQuotes",error);
        }
    };

    self.getOptionChainQuotes = async function({stockCode="", exchangeCode="", expiryDate="", productType="", right="", strikePrice=""}) {
        try {
            if(exchangeCode === "" || exchangeCode === null || exchangeCode.toLowerCase()!=="nfo" || exchangeCode.toLowerCase()!=="bfo") {
                return self.validationErrorResponse(responseMessage.OPT_CHAIN_EXCH_CODE_ERROR);
            }
            else if(productType === "" || productType === null) {
                return self.validationErrorResponse(responseMessage.BLANK_PRODUCT_TYPE_NFO);
            }
            else if(productType.toLowerCase()!=="futures" && productType.toLowerCase()!=="options") {
                return self.validationErrorResponse(responseMessage.PRODUCT_TYPE_ERROR_NFO);
            }
            else if(stockCode===null || stockCode==="")
            {
                return self.validationErrorResponse(responseMessage.BLANK_STOCK_CODE);
            }
            else if(productType.toLowerCase()==="options")
            {
                if((expiryDate===null || expiryDate==="") && (strikePrice===null || strikePrice==="") && (right===null || right===""))
                {
                    return self.validationErrorResponse(responseMessage.NFO_FIELDS_MISSING_ERROR);
                }
                else if((expiryDate!==null || expiryDate!=="") && (strikePrice===null || strikePrice==="") && (right===null || right===""))
                {
                    return self.validationErrorResponse(responseMessage.BLANK_RIGHT_STRIKE_PRICE);
                }
                else if((expiryDate===null || expiryDate==="") && (strikePrice!==null || strikePrice!=="") && (right===null || right===""))
                {
                    return self.validationErrorResponse(responseMessage.BLANK_RIGHT_EXPIRY_DATE);
                }
                else if((expiryDate===null || expiryDate==="") && (strikePrice===null || strikePrice==="") && (right!==null || right!==""))
                {
                    return self.validationErrorResponse(responseMessage.BLANK_EXPIRY_DATE_STRIKE_PRICE);
                }
                else if((right!==null || right!=="") && (right.toLowerCase()!=="call" && right.toLowerCase()!=="put" && right.toLowerCase()!=="options"))
                {
                    return self.validationErrorResponse(responseMessage.RIGHT_TYPE_ERROR);
                }
            }
            let body = {
                "stock_code": stockCode,
                "exchange_code": exchangeCode
            };
            if(expiryDate !== "" && expiryDate !== null) {
                body["expiry_date"] = expiryDate
            }
            if(productType !== "" && productType !== null) {
                body["product_type"] = productType
            }
            if(right !== "" && right !== null) {
                body["right"] = right
            }
            if(strikePrice !== "" && strikePrice !== null) {
                body["strike_price"] = strikePrice
            }
            let headers = self.generateHeaders(body);
            let response = await self.makeRequest(apiRequest.GET,apiEndpoint.OPT_CHAIN, body, headers);
            return response.data;
         
        } catch (error) {
            self.errorException("getOptionChainQuotes",error);
        }
    };

    self.squareOff = async function(
        {sourceFlag = "", stockCode = "", exchangeCode  = "", quantity  = "", price  = "", action  = "", orderType  = "", validity  = "", stoploss  = "", 
            disclosedQuantity  = "", protectionPercentage  = "", settlementId  = "", marginAmount  = "", openQuantity  = "", coverQuantity  = "", 
            productType  = "", expiryDate  = "", right  = "", strikePrice  = "", validityDate  = "", tradePassword  = "", aliasName  = ""}) 
        {
        try {
            if(exchangeCode === "" || exchangeCode === null || stockCode === "" || stockCode === null) {
                if(exchangeCode === "" || exchangeCode === null) {
                    return self.validationErrorResponse(responseMessage.BLANK_EXCHANGE_CODE);
                }
                if(stockCode === "" || stockCode === null) {
                    return self.validationErrorResponse(responseMessage.BLANK_STOCK_CODE);
                }
            }   
            else if(productType !== "" && productType !== null && !Boolean(typeList.PRODUCT_TYPES.includes(productType.toLowerCase()))) {
                return self.validationErrorResponse(responseMessage.PRODUCT_TYPE_ERROR);
            }
            else if(right !== "" && right !== null && !Boolean(typeList.RIGHT_TYPES.includes(right.toLowerCase()))) {
                return self.validationErrorResponse(responseMessage.RIGHT_TYPE_ERROR);
            }
            else if(action !== "" && action !== null && !Boolean(typeList.ACTION_TYPES.includes(action.toLowerCase()))) {
                return self.validationErrorResponse(responseMessage.ACTION_TYPE_ERROR);
            }
            else if(validity !== "" && validity !== null && !Boolean(typeList.VALIDITY_TYPES.includes(validity.toLowerCase()))) {
                return self.validationErrorResponse(responseMessage.VALIDITY_TYPE_ERROR);
            }
            else if(orderType !== "" && orderType !== null && !Boolean(typeList.ORDER_TYPES.includes(order_type.toLowerCase()))) {
                return self.validationErrorResponse(responseMessage.ORDER_TYPE_ERROR);
            }


            let body = {
                "source_flag": sourceFlag,
                "stock_code": stockCode,
                "exchange_code": exchangeCode,
                "quantity": quantity,
                "price": price,
                "action": action,
                "order_type": orderType,
                "validity": validity,
                "stoploss_price": stoploss,
                "disclosed_quantity": disclosedQuantity,
                "protection_percentage": protectionPercentage,
                "settlement_id": settlementId,
                "margin_amount": marginAmount,
                "open_quantity": openQuantity,
                "cover_quantity": coverQuantity,
                "product_type": productType,
                "expiry_date": expiryDate,
                "right": right,
                "strike_price": strikePrice,
                "validity_date": validityDate,
                "alias_name": aliasName,
                "trade_password": tradePassword
            };
            let headers = self.generateHeaders(body);
            let response = await self.makeRequest(apiRequest.POST, apiEndpoint.SQUARE_OFF, body, headers);
            return response.data;
        } catch (error) {
            self.errorException("squareOff",error);
        }
    };

    self.getTradeList = async function({fromDate = "", toDate = "", exchangeCode = "", productType = "", action = "", stockCode = ""}) {
        try {
            if(exchangeCode === "" || exchangeCode === null) {
                return self.validationErrorResponse(responseMessage.BLANK_EXCHANGE_CODE);
            }
            else if(productType !== "" && productType !== null && !Boolean(typeList.PRODUCT_TYPES.includes(productType.toLowerCase()))) {
                return self.validationErrorResponse(responseMessage.PRODUCT_TYPE_ERROR);
            }
            else if(action !== "" && action !== null && !Boolean(typeList.ACTION_TYPES.includes(action.toLowerCase()))) {
                return self.validationErrorResponse(responseMessage.ACTION_TYPE_ERROR);
            }
            let body = {
                "exchange_code": exchangeCode,
            };

            if(fromDate !== "" && fromDate !== null) {
                body["from_date"] = fromDate;
            }
            if(toDate !== "" && toDate !== null) {
                body["to_date"] = toDate;
            }
            if(productType !== "" && productType !== null) {
                body["product_type"] = productType;
            }
            if(action !== "" && action !== null) {
                body["action"] = action;
            }
            if(stockCode !== "" && stockCode !== null) {
                body["stock_code"] = stockCode;
            }
            let headers = self.generateHeaders(body);
            let response = await self.makeRequest(apiRequest.GET, apiEndpoint.TRADE, body, headers);
            return response.data;
        } catch (error) {
            self.errorException("getTradeList",error);
        }
    };

    self.getTradeDetail = async function({exchangeCode = "", orderId = ""}) {
        try {
            if(exchangeCode === "" || exchangeCode === null) {
                return self.validationErrorResponse(responseMessage.BLANK_EXCHANGE_CODE);
            }
            else if(orderId === "" || orderId === null) {
                return self.validationErrorResponse(responseMessage.BLANK_ORDER_ID);
            }

            let body = {
                "exchange_code": exchangeCode,
                "order_id": orderId
            };
            let headers = self.generateHeaders(body);
            let response = await self.makeRequest(apiRequest.GET, apiEndpoint.TRADE, body, headers);
            return response.data;
        } catch (error) {
            self.errorException("getTradeDetail",error);
        }
    };

    
    self.previewOrder = async function({ stockCode="",exchangeCode="",productType="",orderType="",price="",action="",quantity="",expiryDate="",right="",strikePrice="",specialFlag="",stoploss="",orderRateFresh=""})
    {
        try
        {
            if(exchangeCode === "" || exchangeCode === null) {
                return self.validationErrorResponse(responseMessage.BLANK_EXCHANGE_CODE);
            }
            if(stockCode === "" || stockCode === null) {
                return self.validationErrorResponse(responseMessage.BLANK_STOCK_CODE);
            }
            if(productType === "" || productType === null) {
                return self.validationErrorResponse(responseMessage.BLANK_PRODUCT_TYPE_NFO);
            }
            if(right !== "" && right !== null && !Boolean(typeList.RIGHT_TYPES.includes(right.toLowerCase()))) {
                return self.validationErrorResponse(responseMessage.RIGHT_TYPE_ERROR);
            }
            if(action === "" || action === null) {
                return self.validationErrorResponse(responseMessage.BLANK_ACTION);
            }
            if(orderType === "" || orderType === null) {
                return self.validationErrorResponse(responseMessage.BLANK_ORDER_TYPE);
            }

            body = {
                "stock_code": stockCode,
                "exchange_code": exchangeCode,
                "product": productType,
                "order_type": orderType,
                "price": price,
                "action": action,
                "quantity": quantity,
                "expiry_date": expiryDate,
                "right": right,
                "strike_price": strikePrice,
                "specialflag" : specialFlag,
                "stoploss": stoploss,
                "order_rate_fresh": orderRateFresh
                
            }
            let headers = self.generateHeaders(body);
            let response = await self.makeRequest(apiRequest.GET, apiEndpoint.PREVIEW_ORDER, body, headers);
            return response.data;
        }
        catch(error)
        {
            self.errorException("previewOrder",error);
        }
    }

    self.limitCalculator = async function({strikePrice = "",productType = "",expiryDate = "",underlying = "",exchangeCode = "",orderFlow = "",stopLossTrigger = "",optionType = "",sourceFlag = "",limitRate = "",orderReference = "",availableQuantity = "",marketType = "",freshOrderLimit = ""})
    {
        try
        {
            if(strikePrice === "" || strikePrice === null){
                return self.validationErrorResponse(responseMessage.BLANK_STRIKE_PRICE);
            }
            else if(productType === "" || productType === null)
            {
                return self.validationErrorResponse(responseMessage.BLANK_PRODUCT_TYPE);
            }
            else if(sourceFlag === "" || sourceFlag === null)
            {
                return self.validationErrorResponse(responseMessage.BLANK_SOURCE_FLAG);
            }
            else if(underlying === "" || underlying === null)
            {
                return self.validationErrorResponse(responseMessage.BLANK_UNDERLYING);
            }
            else if(exchangeCode === "" || exchangeCode === null)
            {
                return self.validationErrorResponse(responseMessage.BLANK_EXCHANGE_CODE);
            }
            else if(orderFlow === "" || orderFlow === null)
            {
                return self.validationErrorResponse(responseMessage.BLANK_ORDER_FLOW);
            }
            else if(optionType === "" || optionType === null)
            {
                return self.validationErrorResponse(responseMessage.BLANK_OPTION_TYPE);
            }
            else if(stopLossTrigger === "" || stopLossTrigger === null)
            {
                return self.validationErrorResponse(responseMessage.BLANK_STOP_LOSS_TRIGGER);
            }
            let body = {
                "strike_price": strikePrice,                                    
                "product_type":productType,                 
                "expiry_date": expiryDate,
                "underlying" : underlying,
                "exchange_code":expiryDate,
                "order_flow" :orderFlow,
                "stop_loss_trigger":stopLossTrigger,
                "option_type":optionType,
                "source_flag" : sourceFlag,
                "limit_rate" : limitRate,
                "order_reference": orderReference,
                "available_quantity":availableQuantity,
                "market_type": marketType,
                "fresh_order_limit":freshOrderLimit
            };
            let headers = self.generateHeaders(body);
            let response = await self.makeRequest(apiRequest.POST, apiEndpoint.LIMITCALCULATOR, body, headers);
            return response.data;
        }
        catch(error)
        {
            self.errorException("limitCalculator",error);
        }
    }

    self.marginCalculator = async function({payloadList = "",exchangeCode = ""})
    {
        try
        {
            let body = {
                "list_of_positions" : payloadList,
                "exchange_code" : exchangeCode
            }
            let headers = self.generateHeaders(body);
            let response = await self.makeRequest(apiRequest.POST, apiEndpoint.MARGINCALCULATOR, body, headers);
            return response.data;

        }
        catch(error)
        {
            self.errorException("marginCalculator",error);
        }
    }

    self.getNames = async function({exchange = "", stockCode = ""})
    {
        exchange = exchange.toLowerCase();
        stockCode = stockCode.toUpperCase();
        let fetchResponse;

        switch(exchange)
        {
        case "nse":
            fetchResponse =  await axios.get(scriptMasterFile.NSE_URL);
            break;
        case "bse":
            fetchResponse = await axios.get(scriptMasterFile.BSE_URL);
            break;
        case "cdnse":
            fetchResponse = await axios.get(scriptMasterFile.CDNSE_URL);
            break;
        case "fonse":
            fetchResponse = await axios.get(scriptMasterFile.FONSE_URL);
            break;
        default:
            fetchResponse = await axios.get(scriptMasterFile.NSE_URL);
            break;
        }
    
        const arr = fetchResponse.data.split(/\r?\n/);
    

        for(var i = 1; i < arr.length; i++)
        {
        const elem = arr[i].split(",");
        
        elem[1] = elem[1].toString('utf-8').match(/(?:"[^"]*"|^[^"]*$)/)[0].replace(/"/g, ""); //FOR EXTRACTING THE CONTENT FROM DOUBLE QUOTES
        elem[60] = elem[60].toString('utf-8').match(/(?:"[^"]*"|^[^"]*$)/)[0].replace(/"/g, ""); // FOR EXTRACTING THE CONTENT IN DOUBLE QUOTES
        elem[0] = elem[0].toString('utf-8').match(/(?:"[^"]*"|^[^"]*$)/)[0].replace(/"/g, "");
        if(elem[1]===stockCode)
        {
            return {
                'status': "SUCCESS",
                'isec_stock_code': elem[1],
                'isec_token': elem[0],
                'company_name':elem[3],
                'isec_token_level1': "4.1!"+ elem[0],
                'isec_token_level2':"4.2!" + elem[0],
                'exchange_stockCode': elem[60],
                'exchange':exchange
            }
        } 
        
        else if(stockCode === elem[60])
        {
            return {
                'status': "SUCCESS",
                'isec_stock_code': elem[1],
                'isec_token': elem[0],
                'company_name':elem[3],
                'isec_token_level1': "4.1!"+ elem[0],
                'isec_token_level2':"4.2!" + elem[0],
                'exchange_stockCode': elem[60],
                'exchange':exchange
            } 
        } 
        

      }
    return(new Map([["Status","404"],["Response","getNames(): Result Not Found"]]));
    
    };

}
exports.BreezeConnect = BreezeConnect;