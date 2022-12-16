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
    self.session_key = "";
    self.api_session = "";
    self.on_ticks = null;
    self.stock_script_dict_list = [];
    self.token_script_dict_list = [];
    self.tux_to_user_value = tuxToUserMap;

    self.socket_connection_response = function(message){
        return {"message":message};
    }

    self.subscribe_exception = function(message){
        throw message;
    }

    self.validation_error_response = function(message){
        return {
                    "Success": "", 
                    "Status": 500, 
                    "Error": message
                };
    }

    self.error_exception = function(func_name,error){
        var message = `${func_name}() Error`;
        throw message + error.stack();
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
                    token: self.session_key
                },
                extraHeaders:{
                    "User-Agent": "node-socketio[client]/socket"
                },
                transports: ["websocket"],
            });
        }
        else if(isOrder == true)
        {
            self.socketOrder = io.connect(urls.LIVE_FEEDS_URL,{
                auth: {
                    user: self.userId,
                    token: self.session_key,
                },
                extraHeaders:{
                    "User-Agent": "node-socketio[client]/socket"
                },
                transports: ["websocket"],
            });
        }
        else if(isOHLCV == true){
            self.socketOHLCV = io.connect(urls.LIVE_OHLC_STREAM_URL,{
                path:"/ohlcvstream/",
                auth: {
                    user: self.userId,
                    token: self.session_key,
                },
                extraHeaders:{
                    "User-Agent": "node-socketio[client]/socket"
                },
                transports: ["websocket"],
            });
        }
        
    };

    self.on_disconnect = function() {
        self.socket.disconnect();
    };
    
    self.generate_session = async function (secretKey,session_key) {
        self.session_key = session_key;
        self.secretKey = secretKey;
        await self.api_util();
        await self.get_stock_script_list();
    };

    self.api_util = async function(){
        try {
            
            headers = {
                "Content-Type": "application/json"
            }
            body = {
                "SessionToken": self.session_key,
                "AppKey": self.appKey
            }
            let response = await self.make_request(apiRequest.GET, apiEndpoint.CUST_DETAILS, body, headers);
            if(response.data['Status']==500){
                self.subscribe_exception(exceptionMessage.AUTHENICATION_EXCEPTION);
            }
            else{
                self.api_session = response.data['Success']['session_token'];
                decodedKey = Buffer.from(self.api_session,'base64').toString('ascii');
                self.userId = decodedKey.split(':')[0];
                self.session_key = decodedKey.split(':')[1];
            }
        } catch (error) {
            self.subscribe_exception(exceptionMessage.AUTHENICATION_EXCEPTION);
        }
    }

    self.watch = function (symbols) {
        if (!self.socket) {
            return;
        } 
        self.socket.emit("join", symbols);
        self.socket.on('stock', self.on_message)
    };

    self.on_ohlc_stream = function(data){
        self.on_ticks(data)
    }

    self.watch_stream_data = function(symbols,channel){
        if (!self.socketOHLCV) {
            return;
        } 
        self.socketOHLCV.emit("join", symbols);
        self.socketOHLCV.on(channel, self.on_ohlc_stream);
    }

    self.unwatch_stream_data = function (symbol) {
        self.socketOHLCV.emit("leave", symbol);
    };


    self.on = function (callback) {
        self.socket.on("stock", callback);
    };

    self.on_message = function(data){
        data = self.parse_data(data);
        self.on_ticks(data);
    }

    self.notify = function(){
        self.socketOrder.on('order', self.on_message)
    }

    self.unwatch = function (symbol) {
        self.socket.emit("leave", symbol);
    };

    self._ws_connect = function()
    {
        if(!self.socketOrder)
        {
            self.connect({isOrder:true});    
        }
    }

    self.ws_connect = function(){
        if (!self.socket){
            self.connect({isOrder:false,isOHLCV:false});
            
        }
    }
    
    self.ws_disconnect = function(){
        if(self.socket)
            self.on_disconnect();
    }

    self.get_data_from_stock_token_value = function(input_stock_token){
        var output_data = {};
        var stock_token = input_stock_token.split(".");
        var exchange_type= stock_token[0];
        var stock_token = stock_token[1].split("!")[1];
        var exchange_code_list={
            "1":"BSE",
            "4":"NSE",
            "13":"NDX",
            "6":"MCX",
        };

        var exchange_code_name = exchange_code_list[exchange_type] || false;
        if(exchange_code_name == false)
            self.subscribe_exception(exceptionMessage.WRONG_EXCHANGE_CODE_EXCEPTION);
        else if(exchange_code_name.toLowerCase() == "bse"){
            stock_data = self.token_script_dict_list[0][stock_token] || false;
            if(stock_data == false)
                self.subscribe_exception(exceptionMessage.STOCK_NOT_EXIST_EXCEPTION.format("BSE",input_stock_token));
        }
        else if(exchange_code_name.toLowerCase() == "nse"){
            stock_data = self.token_script_dict_list[1][stock_token] || false;
            if(stock_data == false){
                stock_data = self.token_script_dict_list[4][stock_token] || false;
                if(stock_data == false)
                    self.subscribe_exception(exceptionMessage.STOCK_NOT_EXIST_EXCEPTION.format("i.e. NSE or NFO",input_stock_token));
                else
                    exchange_code_name = "NFO";
            }
        }
        else if(exchange_code_name.toLowerCase() == "ndx"){
            stock_data = self.token_script_dict_list[2][stock_token] || false;
            if(stock_data == false)
                self.subscribe_exception(exceptionMessage.STOCK_NOT_EXIST_EXCEPTION.format("NDX",input_stock_token));
        }
        else if(exchange_code_name.toLowerCase() == "mcx"){
            stock_data = self.token_script_dict_list[3][stock_token] || false;
            if(stock_data == false)
                self.subscribe_exception(exceptionMessage.STOCK_NOT_EXIST_EXCEPTION.format("MCX",input_stock_token));
        }
        output_data["stock_name"] = stock_data[1];
        var exch_codes = ["nse","bse"]
        if (!Boolean(exch_codes.includes(exchange_code.toLowerCase()))){
            var product_type = stock_data[0].split("-")[0]
            if(product_type.toLowerCase=="fut")
                output_data["product_type"] = "Futures"
            if(product_type.toLowerCase=="opt")
                output_data["product_type"] = "Options"
            var date_string = ""
            for(let date of stock_data[0].split("-").slice(2,5))
                date_string += date + "-"
            output_data["strike_date"] = date_string.slice(0,-1)
            if(stock_data[0].split("-")>5){
                output_data["strike_price"] = stock_data[0].split("-")[5]
                var right = stock_data[0].split("-")[6]
                if(right.toUpperCase()=="PE")
                    output_data["right"] = "Put"
                if(righttoUpperCase()=="CE")
                    output_data["right"] = "Call"
            }
        }
        return output_data
    }

    self.get_stock_token_value = function ({exchange_code="", stock_code="", product_type="", expiry_date="", strike_price="", right="", get_exchange_quotes=true, get_market_depth=true}) {
        if (get_exchange_quotes === false && get_market_depth === false) {
            self.subscribe_exception(exceptionMessage.QUOTE_DEPTH_EXCEPTION);
        } else {
            var exchange_code_name = "";
            var exchange_code_list={
                "BSE":"1.",
                "NSE":"4.",
                "NDX":"13.",
                "MCX":"6.",
                "NFO":"4.",
            };
            var exchange_code_name = exchange_code_list[exchange_code] || false;

            if(exchange_code_name === false) {
                self.subscribe_exception(exceptionMessage.EXCHANGE_CODE_EXCEPTION);
            } 
            else if(stock_code === "") {
                self.subscribe_exception(exceptionMessage.EMPTY_STOCK_CODE_EXCEPTION);
            }
            else {
                var token_value = false;
                if(exchange_code.toLowerCase() === "bse") {
                    var token_value = self.stock_script_dict_list[0][stock_code] || false;
                }
                else if(exchange_code.toLowerCase() === "nse"){
                    token_value = self.stock_script_dict_list[1][stock_code] || false;
                }
                else {
                    if(expiry_date === "") {
                        self.subscribe_exception(exceptionMessage.EXPIRY_DATE_EXCEPTION);
                    }
                    if(product_type.toLowerCase() === "futures") {
                        var contract_detail_value = "FUT"
                    }
                    else if(product_type.toLowerCase() === "options") {
                        contract_detail_value = "OPT"
                    }
                    else {
                        self.subscribe_exception(exceptionMessage.PRODUCT_TYPE_EXCEPTION);
                    }

                    contract_detail_value = contract_detail_value + "-" + stock_code + "-" + expiry_date

                    if(product_type.toLowerCase() === "options") {
                        if(strike_price !== "") {
                            contract_detail_value = contract_detail_value + "-" + strike_price;
                        }
                        else if(strike_price === "" && product_type.toLowerCase() === "options") {
                            self.subscribe_exception(exceptionMessage.STRIKE_PRICE_EXCEPTION);
                        }

                        if(right.toLowerCase() === "put") {
                            contract_detail_value = contract_detail_value + "-" + "PE";
                        }
                        else if(right.toLowerCase() === "call") {
                            contract_detail_value = contract_detail_value + "-" + "CE"
                        }
                        else if(product_type.toLowerCase() === "options") {
                            self.subscribe_exception(exceptionMessage.RIGHT_EXCEPTION);
                        }
                    }
                    if(exchange_code.toLowerCase() === "ndx") {
                        token_value = self.stock_script_dict_list[2][contract_detail_value] || false;
                    }
                    else if(exchange_code.toLowerCase() === "mcx") {
                        token_value = self.stock_script_dict_list[3][contract_detail_value] || false;
                    }
                    else if(exchange_code.toLowerCase() === "nfo") {
                        token_value = self.stock_script_dict_list[4][contract_detail_value] || false;
                    }
                }
                if(token_value === false) {
                    self.subscribe_exception(exceptionMessage.STOCK_INVALID_EXCEPTION);
                }
                
                var exchange_quotes_token_value = false;
                if(get_exchange_quotes !== false) {
                    exchange_quotes_token_value = exchange_code_name + "1!" + token_value;
                }

                var market_depth_token_value = false;
                if(get_market_depth !== false) {
                    market_depth_token_value = exchange_code_name + "2!" + token_value;
                }

                return {"exch_quote_token":exchange_quotes_token_value,"market_depth_token": market_depth_token_value};

            }

        }
    }

    self.parse_market_depth = function(data, exchange){
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

    self.parse_data = function(data){
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
                order_dict["orderFlow"] = self.tux_to_user_value['orderFlow'][data[15].toString().toUpperCase()] || data[15].toString()          // Order Flow
                order_dict["limitMarketFlag"] = self.tux_to_user_value['limitMarketFlag'][data[16].toString().toUpperCase()] || data[16].toString()             //Limit Market Flag
                order_dict["orderType"] = self.tux_to_user_value['orderType'][data[17].toString().toUpperCase()] || data[17].toString()                          //OrderType
                order_dict["orderLimitRate"] = data[18]                     //Limit Rate
                order_dict["productType"] = self.tux_to_user_value['productType'][data[19].toString().toUpperCase()] || data[19].toString()     //Product Type
                order_dict["orderStatus"] = self.tux_to_user_value['orderStatus'][data[20].toString().toUpperCase()] || data[20].toString()     // Order Status
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
                order_dict["productType"] =  self.tux_to_user_value['productType'][data[15].toString().toUpperCase()] || data[15].toString()   //Product Type
                order_dict["optionType"] = self.tux_to_user_value['optionType'][data[16].toString().toUpperCase()] || data[16].toString()      //Option T
                order_dict["exerciseType"] = data[17]                       //Exercise Type
                order_dict["strikePrice"] = data[18]                        //Strike Price
                order_dict["expiryDate"] = data[19]                         //Expiry Date
                order_dict["orderValidDate"] = data[20]                     //Order Valid Date
                order_dict["orderFlow"] = self.tux_to_user_value['orderFlow'][data[21].toString().toUpperCase()] || data[21].toString()                //Order  Flow
                order_dict["limitMarketFlag"] = self.tux_to_user_value['limitMarketFlag'][data[22].toString().toUpperCase()] || data[22].toString()     //Limit Market Flag
                order_dict["orderType"] = self.tux_to_user_value['orderType'][data[23].toString().toUpperCase()] || data[23].toString()                 //Order Type
                order_dict["limitRate"] = data[24]                          //Limit Rate
                order_dict["orderStatus"] = self.tux_to_user_value['orderStatus'][data[25].toString().toUpperCase()] || data[25].toString()              //Order Status
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
        var data_type = data[0].split('!')[0].split('.')[1];
        if(exchange == '6'){
            var data_dict = {};
            data_dict["Symbol"] = data[0];
            data_dict["AndiOPVolume"] = data[1];
            data_dict["Reserved"] = data[2];
            data_dict["IndexFlag"] = data[3];
            data_dict["ttq"] = data[4];
            data_dict["last"] = data[5];
            data_dict["ltq"] = data[6];
            data_dict["ltt"] = (new Date(data[7]*1000)).toString().replace(" GMT+0530 (India Standard Time)",'');
            data_dict["AvgTradedPrice"] = data[8];
            data_dict["TotalBuyQnt"] = data[9];
            data_dict["TotalSellQnt"] = data[10];
            data_dict["ReservedStr"] = data[11];
            data_dict["ClosePrice"] = data[12];
            data_dict["OpenPrice"] = data[13];
            data_dict["HighPrice"] = data[14];
            data_dict["LowPrice"] = data[15];
            data_dict["ReservedShort"] = data[16];
            data_dict["CurrOpenInterest"] = data[17];
            data_dict["TotalTrades"] = data[18];
            data_dict["HightestPriceEver"] = data[19];
            data_dict["LowestPriceEver"] = data[20];
            data_dict["TotalTradedValue"] = data[21];
            marketDepthIndex = 0
            let i=0;
            for(i=22;i<data.length;i++){
                data_dict["Quantity-"+marketDepthIndex.toString()] = data[i][0]
                data_dict["OrderPrice-"+marketDepthIndex.toString()] = data[i][1]
                data_dict["TotalOrders-"+marketDepthIndex.toString()] = data[i][2]
                data_dict["Reserved-"+marketDepthIndex.toString()] = data[i][3]
                data_dict["SellQuantity-"+marketDepthIndex.toString()] = data[i][4]
                data_dict["SellOrderPrice-"+marketDepthIndex.toString()] = data[i][5]
                data_dict["SellTotalOrders-"+marketDepthIndex.toString()] = data[i][6]
                data_dict["SellReserved-"+marketDepthIndex.toString()] = data[i][7]
                marketDepthIndex += 1
            }
        }
        else if(data_type == '1'){
            var data_dict = {
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
                data_dict["ttq"] = data[12]
                data_dict["totalBuyQt"] = data[13]
                data_dict["totalSellQ"] = data[14]
                data_dict["ttv"] = data[15]
                data_dict["trend"] = data[16]
                data_dict["lowerCktLm"] = data[17]
                data_dict["upperCktLm"] = data[18]
                data_dict["ltt"] = (new Date(data[19]*1000)).toString().replace(" GMT+0530 (India Standard Time)",'')
                data_dict["close"] = data[20]
            }
            // For FONSE & CDNSE conversion
            else if(data.length == 23){
                data_dict["OI"] = data[12]
                data_dict["CHNGOI"] = data[13]
                data_dict["ttq"] = data[14]
                data_dict["totalBuyQt"] = data[15]
                data_dict["totalSellQ"] = data[16]
                data_dict["ttv"] = data[17]
                data_dict["trend"] = data[18]
                data_dict["lowerCktLm"] = data[19]
                data_dict["upperCktLm"] = data[20]
                data_dict["ltt"] = (new Date(data[21]*1000)).toString().replace(" GMT+0530 (India Standard Time)",'')
                data_dict["close"] = data[22]
            }
        }
        else{
            var data_dict = {
                "symbol": data[0],
                "time": (new Date(data[1]*1000)).toString().replace(" GMT+0530 (India Standard Time)",''),
                "depth": self.parse_market_depth(data[2], exchange),
                "quotes": "Market Depth"
            }
        }
        if(exchange == '4' && data.length == 21)
            data_dict['exchange'] = 'NSE Equity'
        else if(exchange == '1')
            data_dict['exchange'] = 'BSE'
        else if(exchange == '13')
            data_dict['exchange'] = 'NSE Currency'
        else if(exchange == '4' && data.length == 23)
            data_dict['exchange'] = 'NSE Futures & Options'
        else if(exchange == '6')
            data_dict['exchange'] = 'Commodity'
        return data_dict
    }

    self.get_stock_script_list= async function(){
        try{
            self.stock_script_dict_list = [{},{},{},{},{}]
            self.token_script_dict_list = [{},{},{},{},{}]

            var download = await axios.get(url=urls.STOCK_SCRIPT_CSV_URL)
                            .then(function(resp){return resp});
            var my_list = download.data.replaceAll('\r','').split('\n');

            for (let row_string of my_list){
                var row = row_string.split(',')
                if(row[2] == "BSE"){
                    self.stock_script_dict_list[0][row[3]]=row[5]
                    self.token_script_dict_list[0][row[5]]=[row[3],row[1]]
                }
                else if(row[2] == "NSE"){
                    self.stock_script_dict_list[1][row[3]]=row[5]
                    self.token_script_dict_list[1][row[5]]=[row[3],row[1]]
                }
                else if(row[2] == "NDX"){
                    self.stock_script_dict_list[2][row[7]]=row[5]
                    self.token_script_dict_list[2][row[5]]=[row[7],row[1]]
                }
                else if(row[2] == "MCX"){
                    self.stock_script_dict_list[3][row[7]]=row[5]
                    self.token_script_dict_list[3][row[5]]=[row[7],row[1]]
                }
                else if(row[2] == "NFO"){
                    self.stock_script_dict_list[4][row[7]]=row[5]
                    self.token_script_dict_list[4][row[5]]=[row[7],row[1]]
                }
            }
        }catch(error){
            throw error.toString();
        }
    }

    self.subscribe_feeds = async function({stock_token="", exchange_code="", stock_code="", product_type="", expiry_date="", strike_price="", right="", get_exchange_quotes=true, get_market_depth=true, get_order_notification=false,interval=""}){
        if(interval != ""){
            if(!Boolean(typeList.INTERVAL_TYPES_STREAM_OHLC.includes(interval.toLowerCase())))
                self.socket_connection_response(exceptionMessage.STREAM_OHLC_INTERVAL_ERROR);
            else
                interval = channelIntervalMap[interval];
        }
        if(self.socket){
            var return_object = {}
            if(get_order_notification == true){
                self._ws_connect();
                self.notify()
                return_object = self.socket_connection_response(responseMessage.ORDER_NOTIFICATION_SUBSCRIBED)
            }
            if(stock_token != ""){
                if(interval!=""){
                    if(self.socketOHLCV==null){
                        self.connect({isOHLCV:true})
                    }
                    self.watch_stream_data(stock_token,interval)
                }
                else
                    self.watch(stock_token)
                return_object = self.socket_connection_response(responseMessage.STOCK_SUBSCRIBE_MESSAGE.format(stock_token));
            }
            else if(get_order_notification == true && exchange_code == ""){
                return return_object
            }
            else{
                var token_dict = self.get_stock_token_value({exchange_code:exchange_code, stock_code:stock_code, product_type:product_type, expiry_date:expiry_date, strike_price:strike_price, right:right, get_exchange_quotes:get_exchange_quotes, get_market_depth:get_market_depth});
                if(interval!=""){
                    if(self.socketOHLCV==null){
                        self.connect({isOHLCV:true});
                    }
                    self.watch_stream_data(token_dict["exch_quote_token"],interval);
                }
                else{
                    if(token_dict["exch_quote_token"] != false)
                        self.watch(token_dict["exch_quote_token"]);
                    if( token_dict["market_depth_token"] != false)
                        self.watch(token_dict["market_depth_token"]);
                }
                return_object = self.socket_connection_response(responseMessage.STOCK_SUBSCRIBE_MESSAGE.format(stock_code));
            }
            return return_object
        }
    }

    self.unsubscribe_feeds = async function({stock_token="", exchange_code="", stock_code="", product_type="", expiry_date="", strike_price="", right="", interval="",get_exchange_quotes=true, get_market_depth=true, get_order_notification=false}){
        if(interval != ""){
            if(!Boolean(typeList.INTERVAL_TYPES_STREAM_OHLC.includes(interval.toLowerCase())))
                self.socket_connection_response(exceptionMessage.STREAM_OHLC_INTERVAL_ERROR);
            else
                interval = channelIntervalMap[interval];
        }
        if(get_order_notification==true)
        {
            if(self.socketOrder)
            {
                self.socketOrder = null;
                return self.socket_connection_response(responseMessage.ORDER_REFRESH_DISCONNECTED);
            }
            else{
                return self.socket_connection_response(responseMessage.ORDER_REFRESH_NOT_CONNECTED);
            }
        }
        
        else if(self.socket){
            if(stock_token!=""){
                if(interval!="")
                    self.unwatch_stream_data(stock_token);
                else
                    self.unwatch(stock_token);
                return self.socket_connection_response(responseMessage.STOCK_UNSUBSCRIBE_MESSAGE.format(stock_token));
            }
            else{
                var token_dict = self.get_stock_token_value({exchange_code:exchange_code, stock_code:stock_code, product_type:product_type, expiry_date:expiry_date, strike_price:strike_price, right:right, get_exchange_quotes:get_exchange_quotes, get_market_depth:get_market_depth})
                if(interval!="")
                    self.unwatch_stream_data(stock_token);
                else{
                    if(token_dict["exch_quote_token"] != false)
                        self.unwatch(token_dict["exch_quote_token"])
                    if( token_dict["market_depth_token"] != false)
                        self.unwatch(token_dict["market_depth_token"])
                }
                return self.socket_connection_response(responseMessage.STOCK_UNSUBSCRIBE_MESSAGE.format(stock_code));
            }
        }
    }

    self.generate_headers = function(body) {
        try {
            var current_date = new Date().toISOString().split(".")[0] + '.000Z';
            let checksum = sha256(current_date+JSON.stringify(body)+self.secretKey);
            headers = {
                "Content-Type": "application/json",
                'X-Checksum': "token "+checksum,
                'X-Timestamp': current_date,
                'X-AppKey': self.appKey,
                'X-SessionToken': self.api_session
            }
            return headers;
        } catch (error) {
            self.error_exception("generate_headers", error);
        }
    };

    self.make_request = async function(method, endpoint, body, header) {
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
            self.error_exception(exceptionMessage.API_REQUEST_EXCEPTION.format(method,url), error);
        }
    };


    self.get_customer_details = async function(session_token="") {
        try {
            let response = self.validation_error_response("");
            if(session_token === "" || session_token === null) {
                return self.validation_error_response(responseMessage.API_SESSION_ERROR);
            }
            headers = {
                "Content-Type": "application/json"
            }
            body = {
                "SessionToken": session_token,
                "AppKey": self.appKey,
            }
            response = await self.make_request(apiRequest.GET, apiEndpoint.CUST_DETAILS, body, headers);
            delete response.data['Success']['session_token'];
            return(response.data);
           
        } catch (error) {
            self.error_exception("get_customer_details", error);
        }
    };

    self.get_demat_holdings = async function() {
        try {
            let body = {}
            headers = self.generate_headers(body);
            let response = await self.make_request(apiRequest.GET, apiEndpoint.DEMAT_HOLDING, body, headers);
            return response.data;
        } catch (error) {
            self.error_exception("get_demat_holdings", error);
        }
    };  

    self.get_funds = async function() {
        try {
            let body = {}
            headers = self.generate_headers(body);
            let response = await self.make_request(apiEndpoint.GET, apiEndpoint.FUND, body, headers);
            return response.data;
        } catch (error) {
            self.error_exception("get_funds", error);
        }
    };

    self.set_funds = async function({transaction_type="", amount="", segment=""}) {
        try {
            if(transaction_type === "" || transaction_type === null || amount === "" || amount === null || segment === "" || segment === null) {
                if(transaction_type === "" || transaction_type === null) {
                    return self.validation_error_response(responseMessage.BLANK_TRANSACTION_TYPE);
                }
                else if(amount === "" || amount === null) {
                    return self.validation_error_response(responseMessage.BLANK_AMOUNT);
                }
                else if(segment === "" || segment === null) {
                    return self.validation_error_response(responseMessage.BLANK_SEGMENT);
                }
            }
            else if(transaction_type.toLowerCase() !=="debit" && transaction_type.toLowerCase() !== "credit") {
                return self.validation_error_response(responseMessage.TRANSACTION_TYPE_ERROR);
            }
            else if(parseInt(amount) <= 0) {
                return self.validation_error_response(responseMessage.ZERO_AMOUNT_ERROR);
            }
            let body = {
                "transaction_type": transaction_type,
                "amount": amount,
                "segment": segment
            }
            let headers = self.generate_headers(body);
            let response = await self.make_request(apiRequest.POST, apiEndpoint.FUND, body, headers);
            return response.data;
        } catch (error) {
            console.log("set_funds() Error - ", error);
        }
    };

    self.get_historical_data = async function({interval="", from_date="", to_date="", stock_code="", exchange_code="", product_type="", expiry_date="", right="", strike_price=""}) {
        try {
            if(interval === "" || interval === null) {
                return self.validation_error_response(responseMessage.BLANK_INTERVAL);
            }
            else if(!Boolean(typeList.INTERVAL_TYPES.includes(interval.toLowerCase()))) {
                return self.validation_error_response(responseMessage.INTERVAL_TYPE_ERROR);
            }
            else if(exchange_code === "" || exchange_code === null) {
                return self.validation_error_response(responseMessage.BLANK_EXCHANGE_CODE);
            }
            else if(exchange_code.toLowerCase() !== "nse" && exchange_code.toLowerCase() !== "nfo" && exchange_code.toLowerCase() !== "bse") {
                return self.validation_error_response(responseMessage.EXCHANGE_CODE_ERROR);
            }
            else if(from_date === "" || from_date === null) {
                return self.validation_error_response(responseMessage.BLANK_FROM_DATE);
            }
            else if(to_date === "" || to_date === null) {
                return self.validation_error_response(responseMessage.BLANK_TO_DATE);
            }
            else if(stock_code === "" || stock_code === null) {
                return self.validation_error_response(responseMessage.BLANK_STOCK_CODE);
            }
            else if(exchange_code.toLowerCase() === "nfo") {
                let pType = ["futures","options","futureplus","optionplus"];
                if(product_type === "" || product_type === null) {
                      return self.validation_error_response(responseMessage.BLANK_PRODUCT_TYPE_NFO);
                }
                else if(!Boolean(typeList.PRODUCT_TYPES_HIST.includes(product_type.toLowerCase()))) {
                    return self.validation_error_response(responseMessage.PRODUCT_TYPE_ERROR);
                }
                else if(product_type.toLowerCase() === "options" && (strike_price === "" || strike_price === null)) {
                    return self.validation_error_response(responseMessage.BLANK_STRIKE_PRICE);
                }
                else if(expiry_date === "" || expiry_date === null) {
                    return self.validation_error_response(responseMessage.BLANK_EXPIRY_DATE);
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
                "from_date": from_date,
                "to_date": to_date,
                "stock_code": stock_code,
                "exchange_code": exchange_code
            }

            if(product_type !== "" && product_type !== null) {
                body["product_type"] = product_type;
            }
            if(expiry_date !== "" && expiry_date !== null) {
                body["expiry_date"] = expiry_date;
            }
            if(strike_price !== "" && strike_price !== null) {
                body["strike_price"] = strike_price;
            }
            if(right != "" && right !== null){
                body["right"] = right
            }
            let headers = self.generate_headers(body);
            let response = await self.make_request(
                apiRequest.GET, apiEndpoint.HIST_CHART, body, headers);
            return response.data;
        } catch (error) {
            self.error_exception("get_historical_data",error);
        }
    }

    self.get_historical_data_v2 = async function({interval="", from_date="", to_date="", stock_code="", exchange_code="", product_type="", expiry_date="", right="", strike_price=""}) {
        try {
            if(interval === "" || interval === null) {
                return self.validation_error_response(responseMessage.BLANK_INTERVAL);
            }
            else if(!Boolean(typeList.INTERVAL_TYPES_HIST_V2.includes(interval.toLowerCase()))) {
                return self.validation_error_response(responseMessage.INTERVAL_TYPE_ERROR_HIST_V2);
            }
            else if(exchange_code === "" || exchange_code === null) {
                return self.validation_error_response(responseMessage.BLANK_EXCHANGE_CODE);
            }
            else if(!Boolean(typeList.EXCHANGE_CODES_HIST_V2.includes(exchange_code.toLowerCase()))) {
                return self.validation_error_response(responseMessage.EXCHANGE_CODE_HIST_V2_ERROR);
            }
            else if(from_date === "" || from_date === null) {
                return self.validation_error_response(responseMessage.BLANK_FROM_DATE);
            }
            else if(to_date === "" || to_date === null) {
                return self.validation_error_response(responseMessage.BLANK_TO_DATE);
            }
            else if(stock_code === "" || stock_code === null) {
                return self.validation_error_response(responseMessage.BLANK_STOCK_CODE);
            }
            else if(!Boolean(typeList.DERI_EXCH_CODES.includes(exchange_code.toLowerCase()))) {
                if(product_type === "" || product_type === null) {
                    return self.validation_error_response(responseMessage.BLANK_PRODUCT_TYPE_HIST_V2);
                }
                else if(!Boolean(typeList.PRODUCT_TYPES_HIST.includes(product_type.toLowerCase()))) {
                    return self.validation_error_response(responseMessage.PRODUCT_TYPE_ERROR_HIST_V2);
                }
                else if(product_type.toLowerCase() === "options" && (strike_price === "" || strike_price === null)) {
                    return self.validation_error_response(responseMessage.BLANK_STRIKE_PRICE);
                }
                else if(expiry_date === "" || expiry_date === null) {
                    return self.validation_error_response(responseMessage.BLANK_EXPIRY_DATE);
                }
            }
            if(interval === "1minute") {
                interval = "minute";
            }
            else if(interval === "1day") {
                interval = "day";
            }

            let url_params = {
                "interval": interval,
                "from_date": from_date,
                "to_date": to_date,
                "stock_code": stock_code,
                "exchange_code": exchange_code
            }

            if(product_type !== "" && product_type !== null) {
                url_params["product_type"] = product_type;
            }
            if(expiry_date !== "" && expiry_date !== null) {
                url_params["expiry_date"] = expiry_date;
            }
            if(strike_price !== "" && strike_price !== null) {
                url_params["strike_price"] = strike_price;
            }
            if(right != "" && right !== null){
                url_params["right"] = right
            }
            let headers = {
                "Content-Type": "application/json",
                'X-SessionToken':self.api_session,
                'apikey':self.appKey
            }
            let response = await axios.get(urls.LIVE_OHLC_STREAM_URL,{
                params:url_params, headers:headers
            })
            return response.data;
        } catch (error) {
            self.error_exception("get_historical_data",error);
        }
    }

    self.add_margin = async function({product_type="", stock_code="", exchange_code="", settlement_id="", add_amount="", margin_amount="", open_quantity="", cover_quantity="", category_index_per_stock="", expiry_date="", right="", contract_tag="", strike_price="", segment_code=""}) {
        try {
            if(exchange_code === "" || exchange_code === null) {
                return self.validation_error_response(responseMessage.BLANK_EXCHANGE_CODE);
            }
            else if(product_type !== "" && product_type !== null && !Boolean(typeList.PRODUCT_TYPES.includes(product_type.toLowerCase()))) {
                return self.validation_error_response(responseMessage.PRODUCT_TYPE_ERROR);
            }
            else if(right !== "" && right !== null && !Boolean(typeList.RIGHT_TYPES.includes(right.toLowerCase()))) {
                return self.validation_error_response(responseMessage.RIGHT_TYPE_ERROR);
            }
            let body = {
                "exchange_code": exchange_code
            }

            if (product_type !== "" && product_type !== null) {
                body["product_type"] = product_type;
            }
            if(stock_code !== "" && stock_code !== null) {
                body["stock_code"] = stock_code;
            }
            if(cover_quantity !== "" && cover_quantity !== null) {
                body["cover_quantity"] = cover_quantity;
            }
            if(category_index_per_stock != "" && category_index_per_stock !== null){
                body["category_index_per_stock"] = category_index_per_stock
            }
            if(contract_tag != "" && contract_tag !== null){
                body["contract_tag"] = contract_tag
            }
            if(margin_amount !== "" && margin_amount !== null) {
                body["margin_amount"] = margin_amount;
            }
            if(expiry_date !== "" && expiry_date !== null) {
                body["expiry_date"] = expiry_date;
            }
            if(right != "" && right !== null){
                body["right"] = right
            }
            if(strike_price != "" && strike_price !== null){
                body["strike_price"] = strike_price
            }
            if(segment_code != "" && segment_code !== null){
                body["segment_code"] = segment_code
            }
            if(settlement_id != "" && settlement_id !== null){
                body["settlement_id"] = settlement_id
            }
            if(add_amount != "" && add_amount !== null){
                body["add_amount"] = add_amount
            }
            if(open_quantity != "" && open_quantity !== null){
                body["open_quantity"] = open_quantity
            }
            let headers = self.generate_headers(body);
            let response = await self.make_request(apiRequest.POST, apiEndpoint.MARGIN, body, headers);
            return response.data;
        } catch (error) {
            self.error_exception("add_margin",error);
        }
    };

    self.get_margin = async function(exchange_code="") {
        try {
            if(exchange_code === "" || exchange_code === null) {
                return self.validation_error_response(responseMessage.BLANK_EXCHANGE_CODE);
            }
            let body = {
                "exchange_code": exchange_code
            }
            let headers = self.generate_headers(body);
            let response = await self.make_request(apiRequest.GET, apiEndpoint.MARGIN, body, headers);
            return response.data;
        } catch (error) {
            self.error_exception("get_margin",error);
        }
    };

    self.place_order = async function({stock_code="", exchange_code="", product="", action="", order_type="", stoploss="", quantity="", price="", validity="", validity_date="", disclosed_quantity="", expiry_date="", right="", strike_price="", user_remark=""}) {
        try {
            if(stock_code === "" || stock_code === null || exchange_code === "" || exchange_code === null || product === "" || product === null || action === "" || action === null || order_type === "" || order_type === null || quantity === "" || quantity === null || price === "" || price === null || action === "" || action == null) {
                if(stock_code === "" || stock_code === null) {
                    return self.validation_error_response(responseMessage.BLANK_STOCK_CODE);
                }
                else if(exchange_code === "" || exchange_code === null) {
                    return self.validation_error_response(responseMessage.BLANK_EXCHANGE_CODE);
                }
                else if(product === "" || product === null) {
                    return self.validation_error_response(responseMessage.BLANK_PRODUCT_TYPE);
                }
                else if(action === "" || action === null) {
                    return self.validation_error_response(responseMessage.BLANK_ACTION);
                }
                else if(order_type === "" || order_type === null) {
                    return self.validation_error_response(responseMessage.BLANK_ORDER_TYPE);
                }
                else if(quantity === "" || quantity === null) {
                    return self.validation_error_response(responseMessage.BLANK_QUANTITY);
                }
                else if(validity === "" || validity === null) {
                    return self.validation_error_response(responseMessage.BLANK_VALIDITY);
                }
            }
            else if(!Boolean(typeList.PRODUCT_TYPES.includes(product.toLowerCase()))) {
                return self.validation_error_response(responseMessage.PRODUCT_TYPE_ERROR);
            }
            else if(action.toLowerCase() !== "buy" && action.toLowerCase() !== "sell") {
                return self.validation_error_response(responseMessage.ACTION_TYPE_ERROR);
            }
            else if(order_type.toLowerCase() !== "limit" && order_type.toLowerCase() !== "market" && order_type.toLowerCase() !== "stoploss") {
                return self.validation_error_response(responseMessage.ORDER_TYPE_ERROR);
            }
            else if(validity.toLowerCase() !== "day" && validity.toLowerCase() !== "ioc" && validity.toLowerCase() !== "vtc") {
                return self.validation_error_response(responseMessage.VALIDITY_TYPE_ERROR);
            }
            else if(right !== "" && right !== null && (right.toLowerCase() !== "put" && right.toLowerCase() !== "call" && right.toLowerCase() !== "others")) {
                return self.validation_error_response(responseMessage.RIGHT_TYPE_ERROR);
            }

            let body = {
                "stock_code": stock_code,
                "exchange_code": exchange_code,
                "product": product,
                "action": action,
                "order_type": order_type,
                "quantity": quantity,
                "price": price,
                "validity": validity,
            };

            if(stoploss !== "" && stoploss !== null) {
                body["stoploss"] = stoploss;
            }
            if(validity_date !== "" && validity_date !== null) {
                body["validity_date"] = validity_date;
            }
            if(disclosed_quantity !== "" && disclosed_quantity !== null) {
                body["disclosed_quantity"] = disclosed_quantity;
            }
            if(expiry_date !== "" && expiry_date !== null) {
                body["expiry_date"] = expiry_date;
            }
            if(right !== "" && right !== null) {
                body["right"] = right;
            }
            if(strike_price !== "" && strike_price !== null) {
                body["strike_price"] = strike_price;
            }
            if(user_remark !== "" && user_remark !== null) {
                body["user_remark"] = user_remark;
            }
            let headers = self.generate_headers(body);
            let response = await self.make_request(apiRequest.POST, apiEndpoint.ORDER, body, headers);
            return response.data;
        } catch (error) {
            self.error_exception("place_order",error);
        }
    };

    self.get_order_detail = async function({exchange_code="", order_id="" }) {
        try {
            if(exchange_code === "" && exchange_code === null && order_id === "" && order_id === null) {
                if(exchange_code === "" && exchange_code === null) {
                    return self.validation_error_response(responseMessage.BLANK_EXCHANGE_CODE);
                }
                else if(order_id === "" && order_id === null) {
                    return self.validation_error_response(responseMessage.BLANK_ORDER_ID);
                }
            }
            let body = {
                "exchange_code": exchange_code,
                "order_id": order_id
            }

            let headers = self.generate_headers(body);
            let response = await self.make_request(apiRequest.GET, apiEndpoint.ORDER, body, headers);
            return response.data;
        } catch (error) {
            self.error_exception("get_order_detail",error);
        }
    };

    self.get_order_list = async function({exchange_code = "", from_date = "", to_date = ""}) {
        try {
            if(exchange_code === "" || exchange_code === null || from_date === "" || from_date === null || to_date === "" || to_date === null) {
                if(exchange_code === "" || exchange_code === null) {
                    return self.validation_error_response(responseMessage.BLANK_EXCHANGE_CODE);
                }
                else if(from_date === "" || from_date === null) {
                    return self.validation_error_response(responseMessage.BLANK_FROM_DATE);
                }
                else if(to_date === "" || to_date === null) {
                    return self.validation_error_response(responseMessage.BLANK_TO_DATE);
                }
            }
            let body = {
                "exchange_code": exchange_code,
                "from_date": from_date,
                "to_date": to_date
            };

            let headers = self.generate_headers(body)
            let response = await self.make_request(apiRequest.GET, apiEndpoint.ORDER, body, headers);
            return response.data;
        } catch (error) {
            self.error_exception("get_order_list",error);
        }
    };

    self.cancel_order = async function({exchange_code = "", order_id = ""}) {
        try {
            if(exchange_code === "" || exchange_code === null && order_id === "" || order_id === null) {
                if(exchange_code === "" || exchange_code === null) {
                    return self.validation_error_response(responseMessage.BLANK_EXCHANGE_CODE);
                }
                else if(order_id === "" || order_id === null) {
                    return self.validation_error_response(responseMessage.BLANK_ORDER_ID);
                }
            }
            let body = {
                "exchange_code": exchange_code,
                "order_id": order_id
            };

            let headers = self.generate_headers(body)
            let response = await self.make_request(apiRequest.DELETE, apiEndpoint.ORDER, body, headers)
            return response.data;
        } catch (error) {
            self.error_exception("cancel_order",error);
        }
    };

    self.modify_order = async function({order_id = "", exchange_code = "", order_type = "", stoploss = "", quantity = "", price = "", validity = "", disclosed_quantity = "", validity_date = ""}) {
        try {
            if(exchange_code === "" || exchange_code === null || order_id === "" || order_id === null) {
                if(exchange_code === "" || exchange_code === null) {
                    return self.validation_error_response(responseMessage.BLANK_EXCHANGE_CODE);
                }
                else if(order_id === "" || order_id === null) {
                    return self.validation_error_response(responseMessage.BLANK_ORDER_ID);
                }
            }
            else if(order_type !== "" && order_type !== null && !Boolean(typeList.ORDER_TYPES.includes(order_type.toLowerCase()))) {
                return self.validation_error_response(responseMessage.BLANK_ORDER_TYPE);
            }
            else if(validity !== "" && validity !== null && !Boolean(typeList.VALIDITY_TYPES.includes(validity.toLowerCase()))) {
                return self.validation_error_response(responseMessage.ORDER_TYPE_ERROR);
            }
            let body = {
                "order_id": order_id,
                "exchange_code": exchange_code,
            }

            if(order_type !== "" && order_type !== null) {
                body["order_type"] = order_type;
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
            if(disclosed_quantity !== "" && disclosed_quantity !== null) {
                body["disclosed_quantity"] = disclosed_quantity;
            }
            if(validity_date !== "" && validity_date !== null) {
                body["validity_date"] = validity_date;
            }
            let headers = self.generate_headers(body);
            let response = await self.make_request(apiRequest.PUT, apiEndpoint.ORDER, body, headers);
            return response.data;
        } catch (error) {
            self.error_exception("modify_order",error);
        }
    };

    self.get_portfolio_holdings = async function({exchange_code = "", from_date = "", to_date = "",stock_code = "", portfolio_type = ""}) {
        try {
            if(exchange_code === "" || exchange_code === null) {
                return self.validation_error_response(responseMessage.BLANK_EXCHANGE_CODE);
            }
            let body = {
                "exchange_code": exchange_code,
            };
            if(from_date !== "" && from_date !== null){
                body["from_date"] = from_date
            }
            if(to_date !== "" && to_date !== null){
                body["to_date"] = to_date
            }
            if(stock_code != "" && stock_code !== null){
                body["stock_code"] = stock_code
            }
            if(portfolio_type !== "" && portfolio_type !== null){
                body["portfolio_type"] = portfolio_type
            }
            let headers = self.generate_headers(body)
            let response = await self.make_request(
                apiRequest.GET,apiEndpoint.PORTFOLIO_HOLDING, body, headers)
            return response.data;
        } catch (error) {
            self.error_exception("get_portfolio_holdings",error);
        }
    };

    self.get_portfolio_positions = async function() {
        try {
            let body = {};
            let headers = self.generate_headers(body);
            let response = await self.make_request(
                apiRequest.GET, apiEndpoint.PORTFOLIO_POSITION, body, headers);
            return response.data;
        } catch (error) {
            self.error_exception("get_portfolio_positions",error);
        }
    };

    self.get_quotes = async function({stock_code = "", exchange_code = "", expiry_date = "", product_type = "", right = "", strike_price = ""}) {
        try {
            if(exchange_code === "" || exchange_code === null || stock_code === "" || stock_code === null) {
                if(exchange_code === "" || exchange_code === null) {
                    return self.validation_error_response(responseMessage.BLANK_EXCHANGE_CODE);
                }
                if(stock_code === "" || stock_code === null) {
                    return self.validation_error_response(responseMessage.BLANK_STOCK_CODE);
                }
            }
            else if(product_type !== "" && product_type !== null && !Boolean(typeList.PRODUCT_TYPES.includes(product_type.toLowerCase()))) {
                return self.validation_error_response(responseMessage.PRODUCT_TYPE_ERROR);
            }
            else if(right !== "" && right !== null && !Boolean(typeList.RIGHT_TYPES.includes(right.toLowerCase()))) {
                return self.validation_error_response(responseMessage.RIGHT_TYPE_ERROR);
            }
            let body = {
                "stock_code": stock_code,
                "exchange_code": exchange_code
            };

            if(expiry_date !== "" && expiry_date !== null) {
                body["expiry_date"] = expiry_date
            }
            if(product_type !== "" && product_type !== null) {
                body["product_type"] = product_type
            }
            if(right !== "" && right !== null) {
                body["right"] = right
            }
            if(strike_price !== "" && strike_price !== null) {
                body["strike_price"] = strike_price
            }
            let headers = self.generate_headers(body);
            let response = await self.make_request(apiRequest.GET,apiEndpoint.QUOTE, body, headers);
            return response.data;
        } catch (error) {
            self.error_exception("get_quotes",error);
        }
    };

    self.get_option_chain_quotes = async function({stockCode="", exchangeCode="", expiryDate="", productType="", right="", strikePrice=""}) {
        try {
            if(exchangeCode === "" || exchangeCode === null || exchangeCode!=="nfo") {
                return self.validation_error_response(responseMessage.OPT_CHAIN_EXCH_CODE_ERROR);
            }
            else if(productType === "" || productType === null) {
                return self.validation_error_response(responseMessage.BLANK_PRODUCT_TYPE_NFO);
            }
            else if(productType.toLowerCase()!=="futures" && productType.toLowerCase()!=="options") {
                return self.validation_error_response(responseMessage.PRODUCT_TYPE_ERROR_NFO);
            }
            else if(stockCode===null || stockCode==="")
            {
                return self.validation_error_response(responseMessage.BLANK_STOCK_CODE);
            }
            else if(productType.toLowerCase()==="options")
            {
                if((expiryDate===null || expiryDate==="") && (strikePrice===null || strikePrice==="") && (right===null || right===""))
                {
                    return self.validation_error_response(responseMessage.NFO_FIELDS_MISSING_ERROR);
                }
                else if((expiryDate!==null || expiryDate!=="") && (strikePrice===null || strikePrice==="") && (right===null || right===""))
                {
                    return self.validation_error_response(responseMessage.BLANK_RIGHT_STRIKE_PRICE);
                }
                else if((expiryDate===null || expiryDate==="") && (strikePrice!==null || strikePrice!=="") && (right===null || right===""))
                {
                    return self.validation_error_response(responseMessage.BLANK_RIGHT_EXPIRY_DATE);
                }
                else if((expiryDate===null || expiryDate==="") && (strikePrice===null || strikePrice==="") && (right!==null || right!==""))
                {
                    return self.validation_error_response(responseMessage.BLANK_EXPIRY_DATE_STRIKE_PRICE);
                }
                else if((right!==null || right!=="") && (right.toLowerCase()!=="call" && right.toLowerCase()!=="put" && right.toLowerCase()!=="options"))
                {
                    return self.validation_error_response(responseMessage.RIGHT_TYPE_ERROR);
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
            let headers = self.generate_headers(body);
            let response = await self.make_request(apiRequest.GET,apiEndpoint.OPT_CHAIN, body, headers);
            return response.data;
         
        } catch (error) {
            self.error_exception("get_option_chain_quote",error);
        }
    };

    self.square_off = async function(
        {source_flag = "", stock_code = "", exchange_code  = "", quantity  = "", price  = "", action  = "", order_type  = "", validity  = "", stoploss  = "", 
            disclosed_quantity  = "", protection_percentage  = "", settlement_id  = "", margin_amount  = "", open_quantity  = "", cover_quantity  = "", 
            product_type  = "", expiry_date  = "", right  = "", strike_price  = "", validity_date  = "", trade_password  = "", alias_name  = ""}) 
        {
        try {
            if(exchange_code === "" || exchange_code === null || stock_code === "" || stock_code === null) {
                if(exchange_code === "" || exchange_code === null) {
                    return self.validation_error_response(responseMessage.BLANK_EXCHANGE_CODE);
                }
                if(stock_code === "" || stock_code === null) {
                    return self.validation_error_response(responseMessage.BLANK_STOCK_CODE);
                }
            }   
            else if(product_type !== "" && product_type !== null && !Boolean(typeList.PRODUCT_TYPES.includes(product_type.toLowerCase()))) {
                return self.validation_error_response(responseMessage.PRODUCT_TYPE_ERROR);
            }
            else if(right !== "" && right !== null && !Boolean(typeList.RIGHT_TYPES.includes(right.toLowerCase()))) {
                return self.validation_error_response(responseMessage.RIGHT_TYPE_ERROR);
            }
            else if(action !== "" && action !== null && !Boolean(typeList.ACTION_TYPES.includes(action.toLowerCase()))) {
                return self.validation_error_response(responseMessage.ACTION_TYPE_ERROR);
            }
            else if(validity !== "" && validity !== null && !Boolean(typeList.VALIDITY_TYPES.includes(validity.toLowerCase()))) {
                return self.validation_error_response(responseMessage.VALIDITY_TYPE_ERROR);
            }
            else if(order_type !== "" && order_type !== null && !Boolean(typeList.ORDER_TYPES.includes(order_type.toLowerCase()))) {
                return self.validation_error_response(responseMessage.ORDER_TYPE_ERROR);
            }


            let body = {
                "source_flag": source_flag,
                "stock_code": stock_code,
                "exchange_code": exchange_code,
                "quantity": quantity,
                "price": price,
                "action": action,
                "order_type": order_type,
                "validity": validity,
                "stoploss_price": stoploss,
                "disclosed_quantity": disclosed_quantity,
                "protection_percentage": protection_percentage,
                "settlement_id": settlement_id,
                "margin_amount": margin_amount,
                "open_quantity": open_quantity,
                "cover_quantity": cover_quantity,
                "product_type": product_type,
                "expiry_date": expiry_date,
                "right": right,
                "strike_price": strike_price,
                "validity_date": validity_date,
                "alias_name": alias_name,
                "trade_password": trade_password
            };
            let headers = self.generate_headers(body);
            let response = await self.make_request(apiRequest.POST, apiEndpoint.SQUARE_OFF, body, headers);
            return response.data;
        } catch (error) {
            self.error_exception("square_off",error);
        }
    };

    self.get_trade_list = async function({from_date = "", to_date = "", exchange_code = "", product_type = "", action = "", stock_code = ""}) {
        try {
            if(exchange_code === "" || exchange_code === null) {
                return self.validation_error_response(responseMessage.BLANK_EXCHANGE_CODE);
            }
            else if(product_type !== "" && product_type !== null && !Boolean(typeList.PRODUCT_TYPES.includes(product_type.toLowerCase()))) {
                return self.validation_error_response(responseMessage.PRODUCT_TYPE_ERROR);
            }
            else if(action !== "" && action !== null && !Boolean(typeList.ACTION_TYPES.includes(action.toLowerCase()))) {
                return self.validation_error_response(responseMessage.ACTION_TYPE_ERROR);
            }
            let body = {
                "exchange_code": exchange_code,
            };

            if(from_date !== "" && from_date !== null) {
                body["from_date"] = from_date;
            }
            if(to_date !== "" && to_date !== null) {
                body["to_date"] = to_date;
            }
            if(product_type !== "" && product_type !== null) {
                body["product_type"] = product_type;
            }
            if(action !== "" && action !== null) {
                body["action"] = action;
            }
            if(stock_code !== "" && stock_code !== null) {
                body["stock_code"] = stock_code;
            }
            let headers = self.generate_headers(body);
            let response = await self.make_request(apiRequest.GET, apiEndpoint.TRADE, body, headers);
            return response.data;
        } catch (error) {
            self.error_exception("get_trade_list",error);
        }
    };

    self.get_trade_detail = async function({exchange_code = "", order_id = ""}) {
        try {
            if(exchange_code === "" || exchange_code === null) {
                return self.validation_error_response(responseMessage.BLANK_EXCHANGE_CODE);
            }
            else if(order_id === "" || order_id === null) {
                return self.validation_error_response(responseMessage.BLANK_ORDER_ID);
            }

            let body = {
                "exchange_code": exchange_code,
                "order_id": order_id
            };
            let headers = self.generate_headers(body);
            let response = await self.make_request(apiRequest.GET, apiEndpoint.TRADE, body, headers);
            return response.data;
        } catch (error) {
            self.error_exception("get_trade_detail",error);
        }
    };

    self.get_names = async function({exchange = "", stockCode = ""})
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
                'exchange_stock_code': elem[60],
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
                'exchange_stock_code': elem[60],
                'exchange':exchange
            } 
        } 
        

      }
    return(new Map([["Status","404"],["Response","get_names(): Result Not Found"]]));
    
    };

}

exports.BreezeConnect = BreezeConnect;
