const { ftruncateSync } = require('fs');

var BreezeConnect = require('./breeze_connect/breeze_connect').BreezeConnect;



// var appKey ="9e12o8179&J695!`141J150147277(V7";
// var appSecret = "3072^771C050A5W2692260X3~I64167V";

var appKey ="587D91M1504O1F16)21c13Z605p75W66";
var appSecret = "8002xB729K086+3#4n7V4420^U8361)A";

// var breezeConnect = new BreezeConnect({"appKey":appKey});

// breezeConnect.generate_session(appSecret,"59755").then(function(resp){
//     api_calls();
//     // websocket();
// }).catch(function(err){
//     console.log(err)
// });


// var appKey ="wqD0654y8~17O9092OH48g861wKsa979";
// var appSecret = "e$8%5r1737~113b5H6489pTz9E559792";

var breezeConnect = new BreezeConnect({"appKey":appKey});

breezeConnect.generateSession(appSecret,"2240937").then(function(resp){
    apiCalls();
    // websocket();
}).catch(function(err){
    console.log(err)
});



function onTicks(ticks){
    console.log(ticks);
}

function websocket(){
    breezeConnect.wsConnect()
    // breezeConnect.connect();
    // breezeConnect.watch(["4.1!1594"]);
    // breezeConnect.on(function (data) {
    //   console.log("Data :: " + JSON.stringify(data));
    // });
    breezeConnect.onTicks = onTicks;
    // breezeConnect.subscribe_feeds(stock_token="4.1!1594").then(
    //     function(resp){
    //         console.log(resp);
    //     }
    // )

    breezeConnect.subscribeFeeds({
        stockToken:"6.1!247833",
        interval:"1second"
        // exchange_code:"NSE", 
        // stock_code:"NIFTY", 
        // product_type:"options", 
        // expiry_date:"28-Dec-2022", 
        // strike_price:"81.25", 
        // right:"Call", 
        // get_exchange_quotes:false, 
        // get_market_depth:true,
        // get_order_notification=true
    }
    ).then(function(resp){console.log(resp)});

    // breezeConnect.unsubscribe_feeds({
    //     stock_token:"",
    //     exchange_code:"NSE", 
    //     stock_code:"CNXIT", 
    //     product_type:"", 
    //     expiry_date:"", 
    //     strike_price:"", 
    //     right:"", 
    //     get_exchange_quotes:true, 
    //     get_market_depth:false,
    //     // get_order_notification=true
    // }
    // ).then(function(resp){console.log(resp)});
}

function apiCalls(){

    // Need to check
    // breezeConnect.get_demat_holdings().then(function(resp){
    //     console.log(resp);
    // });

    // breezeConnect.get_funds().then(function(resp){
    //     console.log("Final Response");
    //     console.log(resp);
    // });

    // breezeConnect.set_funds({transaction_type:"debit", 
    //                 amount:"100",
    //                 segment:"Equity"})
    //                 .then(function(resp){
    //                     console.log(resp);
    //                 });

    // breezeConnect.get_historical_data({
    //     interval:"1minute",
    //     from_date:"2022-05-31T00:00:00.000Z",
    //     to_date:"2022-05-31T00:00:00.000Z",
    //     stock_code:"INFTEC",
    //     exchange_code:"NSE"
    // }
    // )
    // .then(function(resp){
    //     console.log(resp);
    // });

    breezeConnect.getHistoricalData(
        {
            interval:"1minute",
            fromDate: "2022-12-15T07:00:00.000Z",
            toDate: "2022-12-17T07:00:00.000Z",
            stockCode:"NIFTY",
            exchangeCode:"NFO",
            productType:"futures",
            expiryDate:"2022-12-29T07:00:00.000Z",
            right:"others",
            strikePrice:"0"
        }
    ).then((resp)=>{
        console.log(resp);
    });

    // breezeConnect.get_historical_data(
    //     {
    //         interval:"1minute",
    //         from_date: "2022-12-15T07:00:00.000Z",
    //         to_date: "2022-12-17T07:00:00.000Z",
    //         stock_code:"NIFTY",
    //         exchange_code:"NSE",
    //         product_type:"futures",
    //         expiry_date:"2022-12-29T07:00:00.000Z",
    //         right:"others",
    //         strike_price:"0"
    //     }
    // ).then((resp)=>{
    //     console.log(resp);
    // });

    //     {
    //         datetime: '2021-11-15 10:54:00',
    //         stock_code: 'AXIBAN',
    //         exchange_code: 'NFO',
    //         product_type: 'Futures',
    //         expiry_date: '25-NOV-21',
    //         right: 'Others',
    //         strike_price: '0',
    //         open: '739.45',
    //         high: '739.95',
    //         low: '739.45',
    //         close: '739.45',
    //         volume: '9600',
    //         open_interest: '49876800',
    //         count: 99
    //       }

    // breezeConnect.get_margin(exchange_code='NSE').then(function(resp){
    //     console.log(resp);
    // })

    // breezeConnect.add_margin(
    //     {
    //         product_type:"cash", 
    //         stock_code:"ITC", 
    //         exchange_code:"NSE", 
    //         settlement_id:"2022106", 
    //         add_amount:"100", 
    //         margin_amount:"265", 
    //         open_quantity:"1", 
    //         cover_quantity:"0", 
    //         category_index_per_stock:"", 
    //         expiry_date:"", 
    //         right:"", 
    //         contract_tag:"", 
    //         strike_price:"", 
    //         segment_code:"N"
    //     }
    // )
    // .then(function(resp){
    //     console.log(resp);
    // })

    // breezeConnect.get_order_list(
    //     {
    //         exchange_code:'NFO',
    //         from_date:"2022-06-01T00:00:00.000Z",
    //         to_date:"2022-06-10T00:00:00.000Z"
    //     }
    // ).then(function(resp){
    //     console.log(resp);
    // })

    // // Need to check
    // breezeConnect.get_portfolio_holdings(
    //     {
    //         exchange_code:"NSE",
    //         from_date:"2022-05-01T06:00:00.000Z",
    //         to_date:"2022-05-30T06:00:00.000Z",
    //         stock_code:"",
    //         portfolio_type:""
    //     }
    // ).then(function(resp){console.log(resp)});


    // Need to check
    // breezeConnect.get_portfolio_positions().then(function(resp){console.log(resp)})

    // breezeConnect.get_quotes(
    //     {
    //         stock_code:"NIFTY",
    //         exchange_code:"NFO",
    //         expiry_date:"2022-06-10T00:00:00.000Z",
    //         product_type:"Options",
    //         right:"Others",
    //         strike_price:"0"
    //     }
    // ).then(function(resp){console.log(resp)});

    // breezeConnect.get_trade_list(
        // {
        //     from_date:"2021-09-28T06:00:00.000Z",
        //     to_date:"2021-11-15T06:00:00.000Z",
        //     exchange_code:"NSE",
        //     product_type:"Cash",
        //     action:"buy",
        //     stock_code:"INFTEC"
        // }
    // ).then(function(resp){console.log(resp)});

    // breezeConnect.place_order(
        // {
        //     stock_code:"NIFTY",
        //     exchange_code:"NFO",
        //     product:"Options",
        //     action:"Buy",
        //     order_type:"Market",
        //     stoploss:"0",
        //     quantity:"50",
        //     price:"",
        //     validity:"Day",
        //     validity_date:"2022-06-06T00:00:00.000Z",
        //     disclosed_quantity:"0",
        //     expiry_date:"2022-06-09T00:00:00.000Z",
        //     right:"Call",
        //     strike_price:"17000",
        //     user_remark:"Test"
        // }
    // ).then(function(resp){console.log(resp)});

    // breezeConnect.place_order(
    //     {
    //         stock_code:"ITC",
    //         exchange_code:"NSE",
    //         product:"Cash",
    //         action:"Buy",
    //         order_type:"Market",
    //         stoploss:"",
    //         quantity:"1",
    //         price:"",
    //         validity:"ioc",
    //         validity_date:"",
    //         disclosed_quantity:"0",
    //         expiry_date:"",
    //         right:"",
    //         strike_price:"",
    //         user_remark:"Test"
    //     }
    // ).then(function(resp){console.log(resp)});

    // breezeConnect.place_order(
    //     {
    //         stock_code:"AXIBAN",
    //         exchange_code:"NFO",
    //         product:"Options",
    //         action:"Buy",
    //         order_type:"Market",
    //         stoploss:"0",
    //         quantity:"100",
    //         price:"",
    //         validity:"ioc",
    //         validity_date:"2022-06-30T00:00:00.000Z",
    //         disclosed_quantity:"0",
    //         expiry_date:"2022-06-30T00:00:00.000Z",
    //         right:"Put",
    //         strike_price:"550",
    //         user_remark:"Test"
    //     }
    // ).then(function(resp){console.log(resp)});

    // breezeConnect.cancel_order(
    //     {
    //         exchange_code:"NSE",
    //         order_id:"202206061300000046"
    //     }
    // ).then(function(resp){console.log(resp)});

    // breezeConnect.modify_order(
    //     {
    //         order_id:"20220607N100000015",
    //         exchange_code:"NSE",
    //         order_type:"Market",
    //         stoploss:"0",
    //         quantity:"5",
    //         price:"",
    //         validity:"ioc",
    //         disclosed_quantity:"0",
    //         validity_date:""
    //     }
    // ).then(function(resp){console.log(resp)});


    // breezeConnect.get_order_detail(
    //     {
    //         exchange_code:'NSE',
    //         order_id:'20220607N100000012'
    //     }
    // )
    // .then(function(resp){console.log(resp)});

    // breezeConnect.get_trade_detail(
    //     {
    //         exchange_code:"NSE",
    //         order_id:"20220607N100000012"
    //     }
    // ).then(function(resp){console.log(resp)});

    // breezeConnect.get_trade_list(
    //     {
    //         from_date:"2022-06-06T06:00:00.000Z",
    //         to_date:"2022-06-09T06:00:00.000Z",
    //         exchange_code:"NSE",
    //         product_type:"",
    //         action:"",
    //         stock_code:""
    //     }).then(function(resp){console.log(resp)});

    // breezeConnect.square_off(
    //     {
    //         source_flag:"",
    //         stock_code:"ITC",
    //         exchange_code:"NSE",
    //         quantity:"2",
    //         price:"0",
    //         action:"sell",
    //         order_type:"market",
    //         validity:"ioc",
    //         stoploss:"0",
    //         disclosed_quantity:"0",
    //         protection_percentage:"",
    //         settlement_id:"",
    //         margin_amount:"",
    //         open_quantity:"",
    //         cover_quantity:"",
    //         product_type:"cash",
    //         expiry_date:"",
    //         right:"",
    //         strike_price:"0",
    //         validity_date:"2022-06-30T00:00:00.000Z",
    //         trade_password:"",
    //         alias_name:""
    //     }
    // ).then(function(resp){console.log(resp)});

}



