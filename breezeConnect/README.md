# Table Of Content

<ul>
 <li><a href="#client">Breeze API Javascript Client</a></li>
 <li><a href="#docslink">API Documentation</a></li>
 <li><a href="#clientinstall">Installing Client</a></li>
 <li><a href="#apiusage">API Usage</a></li>
 <li><a href="#websocket">Websocket Usage</a></li>
 <li><a href="#index_title">List Of Other SDK methods</a></li>
</ul>


<h4 id="client">Breeze API Javascript Client</h4>

breezeapi@icicisecurities.com

The official Javascript client library for the ICICI Securities trading APIs. BreezeConnect is a set of REST-like APIs that allows one to build a complete investment and trading platform. Following are some notable features of Breeze APIs:

1. Execute orders in real time
2. Manage Portfolio
3. Access to 10 years of historical market data including 1 sec OHLCV
4. Streaming live OHLC (websockets)
5. Option Chain API


<h4 id="docslink">API Documentation</h4>

<div class="sticky" >
<ul>
 <li><a href="https://api.icicidirect.com/breezeapi/documents/index.html">Breeze HTTP API Documentation</a></li>
 <li><a href="https://www.npmjs.com/package/breezeconnect/">Javascript client documentation</a></li>
</ul>
</div>

<h4 id="clientinstall">Installing the client</h4>

```
npm install breezeconnect
```

<h4 id="apiusage"> API Usage</h4>

```javascript

var BreezeConnect = require('breezeconnect').BreezeConnect;

var appKey ="your_api_key";
var appSecret = "your_secret_key";

var breeze = new BreezeConnect({"appKey":appKey});


//Obtain your session key from https://api.icicidirect.com/apiuser/login?api_key=YOUR_API_KEY
//Incase your api-key has special characters(like +,=,!) then encode the api key before using in the url as shown below.
console.log("https://api.icicidirect.com/apiuser/login?api_key="+encodeURI("your_api_key"))

//Generate Session
breeze.generateSession(appSecret,"your_api_session").then(function(resp){
    apiCalls();
}).catch(function(err){
    console.log(err)
});

function apiCalls(){
    breeze.getFunds().then(function(resp){
        console.log("Final Response");
        console.log(resp);
        });
}
```
<br>

<h4 id ="websocket"> Websocket Usage</h4>

```javascript

//Connect to websocket(it will connect to rate refresh server)
breeze.wsConnect();

//Callback to receive ticks.
function onTicks(ticks){
    console.log(ticks);
}

//Assign the callbacks
breeze.onTicks = onTicks;


//subscribe stocks feeds by stock-token
breeze.subscribeFeeds({stockToken:"4.1!1594"})
.then(
        function(resp){
            console.log(resp);
        }
)

// subscribe to oneclick strategy stream
breeze.subscribeFeeds({stockToken:"one_click_fno"})
.then(
        function(resp){
            console.log(resp);
        }
)

// unsubscribe to oneclick strategy stream
breeze.unsubscribeFeeds({stockToken:"one_click_fno"})
.then(
        function(resp){
            console.log(resp);
        }
)

// subscribe to i_click_2_gain strategy stream
breeze.subscribeFeeds({stockToken:"i_click_2_gain"})
.then(
        function(resp){
            console.log(resp);
        }
)

// unsubscribe to i_click_2_gain strategy stream
breeze.unsubscribeFeeds({stockToken:"i_click_2_gain"})
.then(
        function(resp){
            console.log(resp);
        }
)


//subscribe stocks feeds
breeze.subscribeFeeds(
    {
        exchangeCode:"NFO", 
        stockCode:"ZEEENT", 
        productType:"options", 
        expiryDate:"31-Mar-2022", 
        strikePrice:"350", 
        right:"Call", 
        getExchangeQuotes:true, 
        getMarketDepth:false
    }
).then(function(resp){console.log(resp)});

//subscribe stocks feeds
breeze.unsubscribeFeeds(
    {
        exchangeCode:"NFO", 
        stockCode:"ZEEENT", 
        productType:"options", 
        expiryDate:"31-Mar-2022", 
        strikePrice:"350", 
        right:"Call", 
        getExchangeQuotes:true, 
        getMarketDepth:false
    }
).then(function(resp){console.log(resp)});


//unsubscribe feeds using stock token
breeze.unsubscribeFeeds({stockToken:"4.1!1594"}).then(
        function(resp){
            console.log(resp);
        }
)

//subscribe to Real Time Streaming OHLCV Data of stocks by stock-token
breeze.subscribeFeeds({stockToken:"1.1!500780", interval:"1second"})
.then(
        function(resp){
            console.log(resp);
        }
)

//subscribe to Real Time Streaming OHLCV Data of stocks
breeze.subscribeFeeds(
    {
        exchangeCode:"NFO", 
        stockCode:"ZEEENT", 
        productType:"options", 
        expiryDate:"31-Mar-2022", 
        strikePrice:"350", 
        right:"Call", 
        getExchangeQuotes:true, 
        getMarketDepth:false,
        interval:"1minute"
    }
).then(function(resp){console.log(resp)});

// unsubscribe from Real Time Streaming OHLCV Data of stocks by stock-token
breeze.unsubscribeFeeds({stockToken:"1.1!500780", interval:"1second"})
.then(
        function(resp){
            console.log(resp);
        }
)

//unsubscribe from Real Time Streaming OHLCV Data of stocks
breeze.unsubscribeFeeds(
    {
        exchangeCode:"NFO", 
        stockCode:"ZEEENT", 
        productType:"options", 
        expiryDate:"31-Mar-2022", 
        strikePrice:"350", 
        right:"Call", 
        getExchangeQuotes:true, 
        getMarketDepth:false,
        interval:"1minute"
    }
).then(function(resp){console.log(resp)});

//subscribe order notification feeds(it will connect to order streaming server)
breeze.subscribeFeeds({getOrderNotification:true}).then(
        function(resp){
            console.log(resp);
        }
)

//unsubscribe order notification feeds(it will disconnect from order streaming server)
breeze.subscribeFeeds({getOrderNotification:true}).then(
        function(resp){
            console.log(resp);
        }
)

//disconnects rate refresh server
breeze.wsDisconnect();

```

---

**NOTE**

Examples for stock_token are "4.1!38071" or "1.1!500780".

Template for stock_token : X.Y!<token>
X : exchange code
Y : Market Level data
Token : ISEC stock code

Value of X can be :
1 for BSE,
4 for NSE,
13 for NDX,
6 for MCX,
4 for NFO,

Value of Y can be :
1 for Level 1 data,
4 for Level 2 data

Token number can be obtained via get_names() function or downloading master security file via 
https://api.icicidirect.com/breezeapi/documents/index.html#instruments


exchangeCode must be 'BSE', 'NSE', 'NDX', 'MCX' or 'NFO'.

stock_code should not be an empty string. Examples for stock_code are "WIPRO" or "ZEEENT".

product_type can be either 'Futures', 'Options' or an empty string. 
Product_type can not be an empty string for exchangeCode 'NDX', 'MCX' and 'NFO'. 

strike_date can be in DD-MMM-YYYY(Ex.: 01-Jan-2022) or an empty string. 
strike_date can not be an empty string for exchangeCode 'NDX', 'MCX' and 'NFO'.

strike_price can be float-value in string or an empty string. 
strike_price can not be an empty string for product_type 'Options'.

right can be either 'Put', 'Call' or an empty string. right can not be an empty string for product_type 'Options'.

Either get_exchange_quotes must be True or get_market_depth must be True. 

Both get_exchange_quotes and get_market_depth can be True, But both must not be False.

For Streaming OHLCV, interval must not be empty and must be equal to either of the following "1second","1minute", "5minute", "30minute"

---

<h4> List of other SDK Methods:</h4>

<h5 id="index_title" >Index</h5>

<div class="sticky" id="index">
<ul>
 <li><a href="#customer_detail">get_customer_details</a></li>
 <li><a href="#demat_holding">get_demat_holdings</a></li>
 <li><a href="#get_funds">get_funds</a></li>
 <li><a href="#set_funds">set_funds</a></li>
 <li><a href="#historical_data1">get_historical_data</a></li>
 <li><a href="#historical_data_v21">get_historical_data_v2</a></li>
 <li><a href="#add_margin">add_margin</a></li>
 <li><a href="#get_margin">get_margin</a></li>
 <li><a href="#place_order">place_order</a></li>
 <li><a href="#order_detail">order_detail</a></li>
 <li><a href="#order_list">order_list</a></li>
 <li><a href="#cancel_order">cancel_order</a></li>
 <li><a href="#modify_order">modify_order</a></li>
 <li><a href="#portfolio_holding">get_portfolio_holding</a></li>
 <li><a href="#portfolio_position">get_portfolio_position</a></li>
 <li><a href="#get_quotes">get_quotes</a></li>
 <li><a href="#get_option_chain">get_option_chain_quotes</a></li>
 <li><a href="#square_off1">square_off</a></li>
 <li><a href="#modify_order">modify_order</a></li>
 <li><a href="#trade_list">get_trade_list</a></li>
 <li><a href="#trade_detail">get_trade_detail</a></li>
 <li><a href="#get_names"> get_names </a></li>
 <li><a href="#preview_order"> preview_order </a></li>
 <li><a href="#limit_calculator"> limit_calculator </a></li>
 <li><a href="#margin_calculator">margin_calculator </a></li>
</ul>
</div>


<h4 id="customer_detail" > Get Customer details by api-session value.</h4>

```javascript
breeze.getCustomerDetails("api session").then((data) => {
    console.log(data);
}).catch((err)=>{
    console.log(err);
});

```

<br>
<a href="#index">Back to Index</a>
<hr>

<h4 id="demat_holding"> Get Demat Holding details of your account.</h4>

```javascript
breeze.getDematHoldings().then(function(resp){
    console.log(resp);
});
```

<br>
<a href="#index">Back to Index</a>
<hr>

<h4 id="get_funds"> Get Funds details of your account.</h4>

```javascript
breeze.getFunds().then(function(resp){
    console.log(resp);
});
```

<br>
<a href="#index">Back to Index</a>
<hr>

<h4 id="set_funds"> Set Funds of your account</h4>

```javascript
breeze.setFunds(
    {
        transactionType:"debit",  //"debit", "credit"
        amount:"100",
        segment:"Equity"
    }
)
.then(function(resp){
    console.log(resp);
});
```
<p> Note: Set Funds of your account by transaction-type as "Credit" or "Debit" with amount in numeric string as rupees and segment-type as "Equity" or "FNO".</p>

<br>
<a href="#index">Back to Index</a>
<hr>

<h4 id="historical_data1">Get Historical Data for Equity</h4>

```javascript
breeze.getHistoricalData(
    {
        interval:"1minute",   //'1minute', '5minute', '30minute','1day'
        fromDate: "2022-08-15T07:00:00.000Z",
        toDate: "2022-08-17T07:00:00.000Z",
        stockCode:"ITC",
        exchangeCode:"NSE",   // 'NSE','BSE','NFO'
        productType:"cash"
    }
)
.then(function(resp){
    console.log(resp);
});
```

<a href="#index">Back to Index</a>

<h4 id="historical_data2">Get Historical Data for Options</h4>

```javascript
breeze.getHistoricalData(
    {
        interval:"1minute",       //'1minute', '5minute', '30minute','1day'
        fromDate: "2022-08-15T07:00:00.000Z",
        toDate: "2022-08-17T07:00:00.000Z",
        stockCode:"CNXBAN",
        exchangeCode:"NFO",      // 'NSE','BSE','NFO'
        productType:"options",   // "futures","options","futureplus","optionplus", 'cash'
        expiryDate:"2022-09-29T07:00:00.000Z",
        right:"call",           // "call","put", "others" 
        strikePrice:"38000"
    }
)
.then((resp)=>{
    console.log(resp);
});
```

<a href="#index">Back to Index</a>

<h4 id="historical_data3">Get Historical Data for Futures</h4>

```javascript
breeze.getHistoricalData(
    {
        interval:"1minute",       //'1minute', '5minute', '30minute','1day'
        fromDate: "2022-08-15T07:00:00.000Z",
        toDate: "2022-08-17T07:00:00.000Z",
        stockCode:"ICIBAN",
        exchangeCode:"NFO",      // 'NSE','BSE','NFO'
        productType:"futures",   // "futures","options","futureplus","optionplus", 'cash'
        expiryDate:"2022-08-25T07:00:00.000Z",
        right:"others",           // "call","put", "others" 
        strikePrice:"0"
    }
)
.then((resp)=>{
    console.log(resp);
});
```
<p> Note : Get Historical Data for specific stock-code by mentioned interval either as "1minute", "5minute", "30minute" or as "1day"</p>
<br>
<a href="#index">Back to Index</a>
<hr>

<h4 id="historical_data_v21">Get Historical Data (version 2) for Equity</h4>

```javascript
breeze.getHistoricalDatav2(
    {
        interval:"1minute",   //'1second', '1minute', '5minute', '30minute','1day'
        fromDate: "2022-08-15T07:00:00.000Z",
        toDate: "2022-08-17T07:00:00.000Z",
        stockCode:"ITC",
        exchangeCode:"NSE",   // 'NSE','BSE','NFO','NDX,'MCX'
        productType:"cash"
    }
)
.then(function(resp){
    console.log(resp);
});
```

<a href="#index">Back to Index</a>

<h4 id="historical_data_v22">Get Historical Data (version 2) for Options</h4>

```javascript
breeze.getHistoricalDatav2(
    {
        interval:"1minute",       //'1second', '1minute', '5minute', '30minute','1day'
        fromDate: "2022-08-15T07:00:00.000Z",
        toDate: "2022-08-17T07:00:00.000Z",
        stockCode:"CNXBAN",
        exchangeCode:"NFO",      // 'NSE','BSE','NFO','NDX,'MCX'
        productType:"options",   // "futures","options",'cash'
        expiryDate:"2022-09-29T07:00:00.000Z",
        right:"call",           // "call","put", "others" 
        strikePrice:"38000"
    }
)
.then((resp)=>{
    console.log(resp);
});
```

<a href="#index">Back to Index</a>

<h4 id="historical_data_v23">Get Historical Data (version 2) for Futures</h4>

```javascript
breeze.getHistoricalDatav2(
    {
        interval:"1minute",       //'1second', '1minute', '5minute', '30minute','1day'
        fromDate: "2022-08-15T07:00:00.000Z",
        toDate: "2022-08-17T07:00:00.000Z",
        stockCode:"ICIBAN",
        exchangeCode:"NFO",      // 'NSE','BSE','NFO'
        productType:"futures",   // "futures","options","futureplus","optionplus", 'cash'
        expiryDate:"2022-08-25T07:00:00.000Z",
        right:"others",           // "call","put", "others" 
        strikePrice:"0"
    }
)
.then((resp)=>{
    console.log(resp);
});
```
<p> 
Note : 

1) Get Historical Data (version 2) for specific stock-code by mentioning interval either as "1second","1minute", "5minute", "30minute" or as "1day". 

2) Maximum candle intervals in one single request is 1000

</p>

<br>
<a href="#index">Back to Index</a>
<hr>


<h4 id="add_margin">Add Margin to your account.</h4>

```javascript

breeze.addMargin(
    {
        productType:"cash",   //"futures","options","futureplus","optionplus","cash","eatm","margin"
        stockCode:"ITC", 
        exchangeCode:"NSE",    // 'NSE','BSE','NFO'
        settlementId:"2022106", 
        addAmount:"100", 
        marginAmount:"265", 
        openQuantity:"1", 
        coverQuantity:"0", 
        categoryIndexPerStock:"", 
        expiryDate:"", 
        right:"",             //"call", "put", "others"
        contractTag:"", 
        strikePrice:"", 
        segmentCode:"N"
    }
)
.then(function(resp){
    console.log(resp);
})
```

<br>
<a href="#index">Back to Index</a>
<hr>

<h4 id="get_margin">Get Margin of your account.</h4>

```javascript
breeze.getMargin(exchangeCode='NSE').then(function(resp){
    console.log(resp);
})
```

<p> Note: Please change exchangeCode=“NFO” to get F&O margin details </p>
<br>
<a href="#index">Back to Index</a>
<hr>


<h4 id="place_order">Placing a Futures Order from your account.</h4>


```javascript
breeze.placeOrder(
    {
        stockCode:"ICIBAN",
        exchangeCode:"NFO",
        product:"futures",
        action:"buy",
        orderType:"limit",
        stoploss:"0",
        quantity:"3200",
        price:"200",
        validity:"day",
        validityDate:"2022-08-22T06:00:00.000Z",
        disclosedQuantity:"0",
        expiryDate:"2022-08-25T06:00:00.000Z",
        right:"others",
        strike_price:"0",
        userRemark:"Test"
    }                
)
.then(function(resp){
    console.log(resp);
})
```                    

<br>
<a href="#index">Back to Index</a>

<h4 id="place_order">Placing a btst Order from your account.</h4>


```javascript

breeze.placeOrder(
    {
        stockCode:"ICIBAN",
        exchangeCode:"NFO",
        product:"futures",
        action:"buy",
        orderType:"limit",
        stoploss:"0",
        quantity:"3200",
        price:"200",
        validity:"day",
        validityDate:"2022-08-22T06:00:00.000Z",
        disclosedQuantity:"0",
        expiryDate:"2022-08-25T06:00:00.000Z",
        right:"others",
        strike_price:"0",
        userRemark:"Test",
        settlementId: "2023008",
        orderSegmentCode = "N"
    }                
)
.then(function(resp){
    console.log(resp);
})

```                    

<br>
<a href="#index">Back to Index</a>
<hr>

<h4 id="place_order2">Placing an Option Order from your account.</h4>


```javascript
breeze.placeOrder(
    {
        stockCode:"NIFTY",
        exchangeCode:"NFO",
        product:"options",
        action:"buy",
        orderType:"market",
        stoploss:"",
        quantity:"50",
        price:"",
        validity:"day",
        validityDate:"2022-08-30T06:00:00.000Z",
        disclosedQuantity:"0",
        expiryDate:"2022-09-29T06:00:00.000Z",
        right:"call",
        strikePrice:"16600"
    }
)
.then(function(resp){
    console.log(resp);
})
```


<br>
<a href="#index">Back to Index</a>

<h4 id="place_order3">Place a cash order from your account.</h4>


```javascript
breeze.placeOrder(
    {
        stockCode:"ITC",
        exchangeCode:"NSE",
        product:"cash",
        action:"buy",
        orderType:"limit",
        stoploss:"",
        quantity:"1",
        price:"305",
        validity:"day"
    }
)
.then(function(resp){
    console.log(resp);
})
```                

<br>
<a href="#index">Back to Index</a>

<h4 id="place_order4">Place an optionplus order</h4>

```javascript

breeze.placeOrder(
    {
        stockCode:"NIFTY",
        exchangeCode:"NFO",
        product:"optionplus",
        action:"buy",
        orderType:"limit",
        stoploss:"15",
        quantity:"50",
        price:"11.25",
        validity:"day",
        validityDate:"2022-12-02T06:00:00.000Z",
        disclosedQuantity:"0",
        expiryDate:"2022-12-08T06:00:00.000Z",
        right:"call",
        strikePrice:"19000",
        orderTypeFresh:"Limit",
        orderRateFresh:"20",
        userRemark:"Test"
    }
)
.then(function(resp){
    console.log(resp);
})
```                
<br>
<a href="#index">Back to Index</a>

<h4 id="place_order5">Place an future plus order</h4>

```javascript

breeze.placeOrder(
    {
        stockCode:"NIFTY",
        exchangeCode:"NFO",                                     
        product:"futureplus",                                    
        action: "Buy",                                            
        orderType: "limit",
        stoploss:"18720",                                            
        quantity:"50",                                          
        price: "18725",                                                                             
        validity:"Day",       
        disclosedQuantity:"0",                                  
        expiryDate:"29-DEC-2022"
    }
)
.then(function(resp){
    console.log(resp);
})

```                
<br>
<p>Future plus - "Stop loss trigger price cannot be less than last traded price for Buy order" </p>
<a href="#index">Back to Index</a>

<hr>

<h4 id="order_detail">Get an order details by exchange-code and order-id from your account.</h4>

```javascript
breeze.getOrderDetail(
    {
        exchangeCode:"NSE",
        orderId:"20220819N100000001"
    }
)
.then(function(resp){
    console.log(resp);
})
```                        

<p> Note: Please change exchangeCode=“NFO” to get details about F&O</p>
<br>
<a href="#index">Back to Index</a>
<hr>

<h4 id="order_list">Get order list of your account.</h4>


```javascript
breeze.getOrderList(
    {
        exchangeCode:"NSE",
        fromDate:"2022-08-01T10:00:00.000Z",
        toDate:"2022-08-19T10:00:00.000Z"
    }
)
.then(function(resp){
    console.log(resp);
})
```

<p> Note: Please change exchangeCode=“NFO” to get details about F&O</p>
<br>
<a href="#index">Back to Index</a>
<hr>


<h4 id="cancel_order">Cancel an order from your account whose status are not Executed.</h4> 


```javascript
breeze.cancelOrder(
    {
        exchangeCode:"NSE",
        orderId:"20220819N100000001"
    }        
)
.then(function(resp){
    console.log(resp);
})
```                    

<br>
<a href="#index">Back to Index</a>
<hr>

<h4 id="modify_order">Modify an order from your account whose status are not Executed.</h4> 


```javascript
breeze.modifyOrder(
    {
        orderId:"202208191100000001",
        exchangeCode:"NFO",
        orderType:"limit",
        stoploss:"0",
        quantity:"250",
        price:"290100",
        validity:"day",
        disclosedQuantity:"0",
        validityDate:"2022-08-22T06:00:00.000Z"
    }
)
.then(function(resp){
    console.log(resp);
})
```

<br>
<a href="#index">Back to Index</a>
<hr>

<h4 id="portfolio_holding">Get Portfolio Holdings of your account.</h4>


```javascript
breeze.getPortfolioHoldings(
    {
        exchangeCode:"NFO",
        fromDate:"2022-08-01T06:00:00.000Z",
        toDate:"2022-08-19T06:00:00.000Z",
        stockCode:"",
        portfolioType:""
    }    
)
.then(function(resp){
    console.log(resp);
})
```

<p> Note: Please change exchangeCode=“NSE” to get Equity Portfolio Holdings</p>
<br>
<a href="#index">Back to Index</a>
<hr>

<h4 id="portfolio_position">Get Portfolio Positions from your account.</h4>


```javascript
breeze.getPortfolioPositions()

```

<br>
<a href="#index">Back to Index</a>
<hr>

<h4 id="get_quotes">Get quotes of mentioned stock-code </h4>


```javascript
breeze.getQuotes(
    {
        stockCode:"ICIBAN",
        exchangeCode:"NFO",
        expiryDate:"2022-08-25T06:00:00.000Z",
        productType:"futures",
        right:"others",
        strikePrice:"0"
    }
)
.then(function(resp){
    console.log(resp);
})
```

<br>
<a href="#index">Back to Index</a>
<hr>

<h4 id="get_option_chain">Get option-chain of mentioned stock-code for product-type Futures where input of expiry-date is not compulsory</h4>


```javascript
breeze.getOptionChainQuotes(
    {
        stockCode:"ICIBAN",
        exchangeCode:"NFO",
        productType:"futures",
        expiryDate:"2022-08-25T06:00:00.000Z"
    }
)
.then(function(resp){
    console.log(resp);
})
```                    

<br>
<a href="#index">Back to Index</a>

<h4 id="get_option_chain2">Get option-chain of mentioned stock-code for product-type Options where atleast 2 input is required out of expiry-date, right and strike-price</h4>


```javascript
breeze.getOptionChainQuotes(
    {
        stockCode:"ICIBAN",
        exchangeCode:"NFO",
        productType:"options",
        expiryDate:"2022-08-25T06:00:00.000Z",
        right:"call",
        strikePrice:"16850"
    }
)
.then(function(resp){
    console.log(resp);
})
```

<br>
<a href="#index">Back to Index</a>
<hr>

<h4 id="square_off1">Square off an Equity Margin Order</h4>


```javascript
breeze.squareOff(
    {
        exchangeCode:"NSE",
        product:"margin",
        stockCode:"NIFTY",
        quantity:"10",
        price:"0",
        action:"sell",
        orderType:"market",
        validity:"day",
        stoploss:"0",
        disclosedQuantity:"0",
        protectionPercentage:"",
        settlementId:"",
        coverQuantity:"",
        openQuantity:"",
        marginAmount:""
    }
)
.then(function(resp){
    console.log(resp);
})
```

<p> Note: Please refer getPortfolioPositions() for settlement id and margin_amount</p>
<br>
<a href="#index">Back to Index</a>

<h4 id="square_off2">Square off an FNO Futures Order</h4>


```javascript
breeze.squareOff(
    {
        exchangeCode:"NFO",
        product:"futures",
        stockCode:"ICIBAN",
        expiryDate:"2022-08-25T06:00:00.000Z",
        action:"sell",
        orderType:"market",
        validity:"day",
        stoploss:"0",
        quantity:"50",
        price:"0",
        validityDate:"2022-08-12T06:00:00.000Z",
        tradePassword:"",
        disclosedQuantity:"0"
    }
)
.then(function(resp){
    console.log(resp);
})
```

<br>
<a href="#index">Back to Index</a>

<h4 id="square_off3">Square off an FNO Options Order</h4>


```javascript
breeze.squareOff(
    {
        exchangeCode:"NFO",
        product:"options",
        stockCode:"ICIBAN",
        expiryDate:"2022-08-25T06:00:00.000Z",
        right:"Call",
        strikePrice:"16850",
        action:"sell",
        orderType:"market",
        validity:"day",
        stoploss:"0",
        quantity:"50",
        price:"0",
        validityDate:"2022-08-12T06:00:00.000Z",
        tradePassword:"",
        disclosedQuantity:"0"
    }
)
.then(function(resp){
    console.log(resp);
})
```                    

<br>
<a href="#index">Back to Index</a>
<hr>

<h4 id="trade_list">Get trade list of your account.</h4>


```javascript
breeze.getTradeList(
    {
        fromDate:"2022-08-01T06:00:00.000Z",
        toDate:"2022-08-19T06:00:00.000Z",
        exchangeCode:"NSE",
        productType:"",
        action:"",
        stockCode:""
    }
)
.then(function(resp){
    console.log(resp);
})
```                        

<p> Note: Please change exchangeCode=“NFO” to get details about F&O</p>
<br>
<a href="#index">Back to Index</a>
<hr>

<h4 id="trade_detail">Get trade detail of your account.</h4>


```javascript
breeze.getTradeDetail(
    {
        exchangeCode:"NSE",
        orderId:"20220819N100000005"
    }
)
.then(function(resp){
    console.log(resp);
})
```

<p> Note: Please change exchangeCode=“NFO” to get details about F&O</p>
<br>
<a href="#index">Back to Index</a>
<hr>


<h4 id = "get_names">Get Names </h4>


```javascript
breeze.getNames({exchangeCode :'NSE',stockCode : 'TATASTEEL'})
.then(function(resp){
    console.log(resp);
})

breeze.getNames({exchangeCode : 'NSE',stockCode : 'RELIANCE'})
.then(function(resp){
    console.log(resp);
})
```
<p>Note: Use this method to find ICICI specific stock codes / token </p>

<a href="#index">Back to Index</a>
<hr>

<h4 id = "preview_order">Preview Order </h4>

```javascript

    breeze.previewOrder(
        {
        stockCode : "ICIBAN",
        exchangeCode : "NSE",
        productType : "margin",
        orderType  : "limit",
        price : "907.05",
        action :"buy",
        quantity : "1",
        specialFlag : "N"
        }
        ).then(function(resp){
        console.log(resp);
        }).catch((err)=>{
            console.log(err);
        })
```

<a href="#index">Back to Index</a>

<hr>

<h4 id = "limit_calculator">Limit Calculator </h4>

```javascript

breeze.limitCalculator(strikePrice = "19200",                                    
    productType = "optionplus",                 
    expiryDate  = "06-JUL-2023",
    underlying = "NIFTY",
    exchangeCode = "NFO",
    orderFlow = "Buy",
    stopLossTrigger = "200.00",
    optionType = "Call",
    sourceFlag = "P",
    limitRate = "",
    orderReference = "",
    availableQuantity = "",
    marketType = "limit",
    freshOrderLimit = "177.70")

```

<a href="#index">Back to Index</a>

<hr>

<h4 id = "margin_calculator">margin calculator </h4>

```javascript

    breeze.marginCalculator([{
            "strike_price": "0",
            "quantity": "15",
            "right": "others",
            "product": "futures",
            "action": "buy",
            "price": "46230.85",
            "expiry_date": "31-Aug-2023",
            "stock_code": "CNXBAN",
            "cover_order_flow": "N",
            "fresh_order_type": "N",
            "cover_limit_rate": "0",
            "cover_sltp_price": "0",
            "fresh_limit_rate": "0",
            "open_quantity": "0"
        },
        {
            "strike_price": "37000",
            "quantity": "15",
            "right": "Call",
            "product": "options",
            "action": "buy",
            "price": "9100",
            "expiry_date": "27-Jul-2023",
            "stock_code": "CNXBAN",
            "cover_order_flow": "N",
            "fresh_order_type": "N",
            "cover_limit_rate": "0",
            "cover_sltp_price": "0",
            "fresh_limit_rate": "0",
            "open_quantity": "0"
        },
        {
            "strike_price": "0",
            "quantity": "50",
            "right": "others",
            "product": "futureplus",
            "action": "buy",
            "price": "19800",
            "expiry_date": "27-Jul-2023",
            "stock_code": "NIFTY",
            "cover_order_flow": "N",
            "fresh_order_type": "N",
            "cover_limit_rate": "0",
            "cover_sltp_price": "0",
            "fresh_limit_rate": "0",
            "open_quantity": "0"
        },
        {
            "strike_price": "19600",
            "quantity": "50",
            "right": "call",
            "product": "optionplus",
            "action": "buy",
            "price": "245.05",
            "expiry_date": "27-Jul-2023",
            "stock_code": "NIFTY",
            "cover_order_flow": "sell",
            "fresh_order_type": "limit",
            "cover_limit_rate": "180.00",
            "cover_sltp_price": "200.00",
            "fresh_limit_rate": "245.05",
            "open_quantity": "50"
        }],exchangeCode = "NFO")

```