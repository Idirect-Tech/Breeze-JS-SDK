# Breeze Connect Javascript SDK 

### To install the package first use the command below

```
npm install breezeconnect
```

### Import Breeze Connect Package and initialize it

```

var BreezeConnect = require('breezeconnect').BreezeConnect;

var appKey ="your_api_key";
var appSecret = "your_secret_key";

var breeze = new BreezeConnect({"appKey":appKey});

```

### Generating session key

Obtain your session key from https://api.icicidirect.com/apiuser/login?api_key=YOUR_API_KEY
Incase your api-key has special characters(like +,=,!) then encode the api key before using in the url as shown below.

```
console.log("https://api.icicidirect.com/apiuser/login?api_key="+encodeURI("your_api_key"))
```


### Promise to generate session. 
This function needs to be called first so that other functions can be invoked. Below is a sample code to generate session and call the desired function.

```
breeze.generate_session(appSecret,"your_api_session").then(function(resp){
    api_calls();
}).catch(function(err){
    console.log(err)
});

function api_calls(){
    breeze.get_funds().then(function(resp){
        console.log("Final Response");
        console.log(resp);
        });
}
```
---

## Functions of Breeze Connect SDK

## Websocket Usage

### Callback function to receive the feeds
```
function on_ticks(ticks){
    console.log(ticks);
}
```

### Connect to Web Sockets
```
breeze.ws_connect()
```

### Initializing Callback
```
breeze.on_ticks = on_ticks;
```

### Subscribe feeds using stock token
```
breeze.subscribe_feeds({stock_token:"4.1!1594"})
.then(
        function(resp){
            console.log(resp);
        }
)
```

### Subscribe feeds using stock code
```
breeze.subscribe_feeds(
    {
        exchange_code:"NFO", 
        stock_code:"ZEEENT", 
        product_type:"options", 
        expiry_date:"31-Mar-2022", 
        strike_price:"350", 
        right:"Call", 
        get_exchange_quotes:true, 
        get_market_depth:false
    }
).then(function(resp){console.log(resp)});
```

### Unsubscribe feeds using stock code
```
breeze.unsubscribe_feeds(
    {
        exchange_code:"NFO", 
        stock_code:"ZEEENT", 
        product_type:"options", 
        expiry_date:"31-Mar-2022", 
        strike_price:"350", 
        right:"Call", 
        get_exchange_quotes:true, 
        get_market_depth:false
    }
).then(function(resp){console.log(resp)});

```

### Unsubscribe feeds using stock token
```
breeze.unsubscribe_feeds({stock_token:"4.1!1594"}).then(
        function(resp){
            console.log(resp);
        }
)
```

### Subscribe order notification feeds

```
breeze.subscribe_feeds({get_order_notification:true}).then(
        function(resp){
            console.log(resp);
        }
)
```

### unsubscribe order notification feeds

```
breeze.subscribe_feeds({get_order_notification:true}).then(
        function(resp){
            console.log(resp);
        }
)
```

### disconnects rate refresh server

``` 
breeze.ws_disconnect();

```

---

### NOTE

Template for stock_token : X.Y!<token><br>

X : exchange code Value of X can be :
1 for BSE <br>
4 for NSE<br>
13 for NDX <br>
6 for MCX<br>
4 for NFO<br>

Y : Market Level data Value of Y can be :<br>
1 : for Level 1 data <br>
2 : for Level 2 data<br>

Token : ISEC stock code Token number can be obtained via get_names() function or downloading master security file via https://api.icicidirect.com/breezeapi/documents/index.html#instruments

Examples for stock_token are "4.1!38071" or "1.1!500780".

exchange_code must be 'BSE', 'NSE', 'NDX', 'MCX' or 'NFO'.

stock_code should not be an empty string. Examples for stock_code are "WIPRO" or "ZEEENT".

product_type can be either 'Futures', 'Options' or an empty string. product_type can not be an empty string for exchange_code 'NDX', 'MCX' and 'NFO'.

strike_date can be in DD-MMM-YYYY(Ex.: 01-Jan-2022) or an empty string. strike_date can not be an empty string for exchange_code 'NDX', 'MCX' and 'NFO'.

strike_price can be float-value in string or an empty string. strike_price can not be an empty string for product_type 'Options'.

right can be either 'Put', 'Call' or an empty string. right can not be an empty string for product_type 'Options'.

Either get_exchange_quotes must be true or get_market_depth must be true. Both get_exchange_quotes and get_market_depth can be true, But both must not be false.

---

## For Breeze APIs

### Get Demat Holding Details
```
breeze.get_demat_holdings().then(function(resp){
    console.log(resp);
});
```

### Get Fund Details
```
breeze.get_funds().then(function(resp){
    console.log("Final Response");
    console.log(resp);
});
```

### Get Customer Details
```
    breeze.get_customer_details("api session").then((data) => {
        console.log(data);
    }).catch((err)=>{
        console.log(err);
    });

```

### Set Funds
```
breeze.set_funds(
    {
        transaction_type:"debit",  //"debit", "credit"
        amount:"100",
        segment:"Equity"
    }
)
.then(function(resp){
    console.log(resp);
});
```


### For Equity Historical Data
```
breeze.get_historical_data(
    {
        interval:"1minute",      //'1minute', '5minute', '30minute','1day'
        from_date:"2022-05-31T00:00:00.000Z",
        to_date:"2022-05-31T00:00:00.000Z",
        stock_code:"INFTEC",
        exchange_code:"NSE"      // 'NSE','BSE','NFO'
    }
)
.then(function(resp){
    console.log(resp);
});
```

### For NFO Historical Data
```
breeze.get_historical_data(
    {
        interval:"1minute",       //'1minute', '5minute', '30minute','1day'
        from_date: "2021-11-15T07:00:00.000Z",
        to_date: "2021-11-17T07:00:00.000Z",
        stock_code:"AXIBAN",
        exchange_code:"NFO",      // 'NSE','BSE','NFO'
        product_type:"futures",   // "futures","options","futureplus","optionplus", 'cash'
        expiry_date:"2021-11-25T07:00:00.000Z",
        right:"others",           // "call","put", "others" 
        strike_price:"0"
    }
)
.then((resp)=>{
    console.log(resp);
});
```

### Get Margin
```
breeze.get_margin(exchange_code='NSE').then(function(resp){
    console.log(resp);
})
```

### Add Margin
```
breeze.add_margin(
    {
        product_type:"cash",   //"futures","options","futureplus","optionplus","cash","eatm","margin"
        stock_code:"ITC", 
        exchange_code:"NSE",    // 'NSE','BSE','NFO'
        settlement_id:"2022106", 
        add_amount:"100", 
        margin_amount:"265", 
        open_quantity:"1", 
        cover_quantity:"0", 
        category_index_per_stock:"", 
        expiry_date:"", 
        right:"",             //"call", "put", "others"
        contract_tag:"", 
        strike_price:"", 
        segment_code:"N"
    }
)
.then(function(resp){
    console.log(resp);
})
```

### Get Order List
```
breeze.get_order_list(
    {
        exchange_code:'NFO',
        from_date:"2022-06-01T00:00:00.000Z",
        to_date:"2022-06-10T00:00:00.000Z"
    }
).then(function(resp){
    console.log(resp);
})
```

### Get Portfolio Holdings
```
breeze.get_portfolio_holdings().then(function(resp){console.log(resp)});
```

### Get Portfolio Positions
```
breeze.get_portfolio_positions().then(function(resp){console.log(resp)})
```

### Get Quotes
```
breeze.get_quotes(
    {
        stock_code:"NIFTY",
        exchange_code:"NFO",
        expiry_date:"2022-06-10T00:00:00.000Z",
        product_type:"Options",  // "futures","options","futureplus","optionplus","cash","eatm","margin"
        right:"Others",          // "call","put", "others"
        strike_price:"0"
    }
).then(function(resp){console.log(resp)});
```
### Get option-chain of mentioned stock-code for product-type Futures where input of expiry-date is not compulsory

```

breeze.get_option_chain_quotes({stock_code:"ICIBAN",
                    exchange_code:"NFO",
                    product_type:"futures",
                    expiry_date:"2022-08-25T06:00:00.000Z"}).then(function(resp){console.log(resp)});

```

### Get option-chain of mentioned stock-code for product-type Options where atleast 2 input is required out of expiry-date, right and strike-price

```

breeze.get_option_chain_quotes({stock_code:"ICIBAN",
                    exchange_code:"NFO",
                    product_type:"options",
                    expiry_date:"2022-08-25T06:00:00.000Z",
                    right:"call",
                    strike_price:"16850"}).then(function(resp){console.log(resp)});


```

### Place order for NFO
```
breeze.place_order(
    {
        stock_code:"AXIBAN",
        exchange_code:"NFO",
        product:"futures",   //"futures","options","futureplus","optionplus","cash","eatm","margin"
        action:"buy",        // "buy", "sell"
        order_type:"limit",  //"limit", "market", "stoploss"
        stoploss:"0",
        quantity:"1200",
        price:"712.00",
        validity:"day",      // "day", "ioc", "vtc"
        validity_date:"2021-12-16T06:00:00.000Z",
        disclosed_quantity:"0",
        expiry_date:"2021-12-25T06:00:00.000Z",
        right:"others",      // "call", "put", "others"
        strike_price:"0",
        user_remark:"Test"
    }
).then(function(resp){console.log(resp)});

```

### Place order for Equity
```
breeze.place_order(
    {
        stock_code:"ITC",
        exchange_code:"NSE",
        product:"Cash",        // "futures","options","futureplus","optionplus","cash","eatm","margin"
        action:"Buy",          // "buy", "sell"
        order_type:"Market",   //"limit", "market", "stoploss"
        stoploss:"",
        quantity:"1",
        price:"",
        validity:"ioc",
        validity_date:"",
        disclosed_quantity:"0",  // "day", "ioc", "vtc"
        expiry_date:"",
        right:"",
        strike_price:"",
        user_remark:"Test"
    }
).then(function(resp){console.log(resp)});
```

### Cancel Order
```
breeze.cancel_order(
    {
        exchange_code:"NSE",
        order_id:"202206061300000046"
    }
).then(function(resp){console.log(resp)});
```


### Modify Order
```
breeze.modify_order(
    {
        order_id:"202111241100000002",
        exchange_code:"NFO",
        order_type:"limit"  // "limit","market","stoploss"
        stoploss:"0",
        quantity:"250",
        price:"290100",
        validity:"day", // "day","ioc","vtc"
        disclosed_quantity:"0",
        validity_date:"2021-12-30T06:00:00.000Z"
    }
).
then(function(resp){console.log(resp)});
```

### Get Order Details
```
breeze.get_order_detail(
    {
        exchange_code:'NSE',
        order_id:'20220607N100000012'
    }
)
.then(function(resp){console.log(resp)});
```


### Get Trade Details
```
breeze.get_trade_detail(
    {
        exchange_code:"NSE",
        order_id:"20220607N100000012"
    }
).then(function(resp){console.log(resp)});
```


### Get Trade List
```
breeze.get_trade_list(
    {
        from_date:"2022-06-06T06:00:00.000Z",
        to_date:"2022-06-09T06:00:00.000Z",
        exchange_code:"NSE",
        product_type:"",
        action:"",
        stock_code:""
    }
).then(function(resp){console.log(resp)});
```

### Square Off
```
breeze.square_off(
    {
        source_flag:"",
        stock_code:"ITC",
        exchange_code:"NSE",
        quantity:"2",
        price:"0",
        action:"sell",          // "buy", "sell"
        order_type:"market",   // "day","ioc","vtc"
        validity:"ioc",
        stoploss:"0",
        disclosed_quantity:"0",
        protection_percentage:"",
        settlement_id:"",
        margin_amount:"",
        open_quantity:"",
        cover_quantity:"",
        product_type:"cash",   // "futures","options","futureplus","optionplus","cash","eatm","margin"
        expiry_date:"",
        right:"",             // "call","put", "others" 
        strike_price:"0",
        validity_date:"2022-06-30T00:00:00.000Z",
        trade_password:"",
        alias_name:""
    }
).then(function(resp){console.log(resp)});
```

### Get Names

```
breeze.get_names({exchange :"nse",stockCode : "NIFSEL"}).then((res)=>console.log(res)).catch(err=>console.log(err));

```
Note: Use this method to find ICICI specific stock codes / token