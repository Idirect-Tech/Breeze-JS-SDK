var BreezeConnect = require("isec_connect").BreezeConnect;

function setup(session) {
  // console.log(session)
  session.connect();
  session.watch(["4.1!GIPCLEQ", "4.1!15083", "1.2!532259"]);
  session.on(function (data) {
    console.log("Data :: " + JSON.stringify(data));
  });
}

var apiKey = "S621u1799v3K35q84Hs1X262524809hJ";
var apiSecret = "$76077P2g61zl6503JG396x637E3567+";
// Redirect the user to the login url obtained
// from login url, and receive the session_token from key named as API_Session
// from the registered redirect url after the login flow.
var feed = new BreezeConnect(apiKey);

feed.generateSession(apiSecret, "54671");

// //  connect to websocket streaming service
// feed.connect();

// // subscribe stocks feeds by stock-token
// feed.subscribe_feeds(stock_token="4.1!GIPCLEQ");

// // subscribe stocks feeds by exchange_code, stock_code, product_type, strike_date, strike_price, right, get_exchange_quotes, get_market_depth,
// feed.subscribe_feeds(stock_token="", exchange_code="", stock_code="", product_type="", expiry_date="", strike_price="", right="", get_exchange_quotes=true, get_market_depth=true)

// function on_ticks(ticks) {
//   //callback to receive ticks
//   console.log("Ticks: {}", format(ticks));
// }

// feed.on_ticks = on_ticks;

// // unsubscribe stocks feeds by stock-token
// feed.unsubscribe_feeds(stock_token="4.1!GIPCLEQ")

// // unsubscribe stocks feeds by exchange_code, stock_code, product_type, strike_date, strike_price, right, get_exchange_quotes, get_market_depth,
// feed.unsubscribe_feeds(exchange_code="", stock_code="", product_type="", strike_date="", strike_price="", right="", get_exchange_quotes=true, get_market_depth=true)

//APIFICATION

// console.log(
//   feed.get_customer_login(
//     (user_id = "NIFTY123"),
//     (password = "test1234"),
//     (date_of_birth = "11111985")
//   )
// );

// console.log(feed.generate_headers());

// console.log(feed.get_customer_details((API_Session = "54671")));

feed.get_demat_holdings();

// console.log(feed.get_funds())

// console.log(feed.set_funds(transaction_type="debit",amount="200",segment="Equity"))

// console.log(feed.get_historical_data(interval="30minute",
//                                        from_date="2021-11-15T07:00:00.000Z",
//                                        to_date="2021-11-15T07:00:00.000Z",
//                                        stock_code="AXIBAN",
//                                        exchange_code="NSE",
//                                        segment="D",
//                                        product_type="F",
//                                        exercise_type="E",
//                                        expiry_date="2021-11-30T07:00:00.000Z",
//                                        option_type="*",
//                                        strike_price="0"))

//  console.log(feed.add_margin(product_type="M",
//                         stock_code="TCS",
//                         exchange_code="BSE",
//                         order_segment_code="N",
//                         order_settlement="2021220",
//                         add_amount="100",
//                         margin_amount="3817.10",
//                         order_open_quantity="10",
//                         cover_quantity="0",
//                         category_INDSTK="",
//                         contract_tag="",
//                         add_margin_amount="",
//                         expiry_date="",
//                         order_optional_exercise_type="",
//                         option_type="",
//                         exercise_type="",
//                         strike_price="",
//                         order_stock_code=""))

// console.log(feed.get_margins(exchange_code="NSE"))

//  console.log(feed.order_placement(stock_code="AXIBAN",
//                             exchange_code="NFO",
//                             product="Futures",
//                             action="Buy",
//                             order_type="Limit",
//                             stoploss="0",
//                             quantity="1200",
//                             price="712.00",
//                             validity="Day",
//                             validity_date="2021-12-16T06:00:00.000Z",
//                             disclosed_quantity="0",
//                             expiry_date="2021-12-25T06:00:00.000Z",
//                             right="Others",
//                             strike_price="0",
//                             user_remark="Test"))

// console.log(feed.get_order_detail(exchange_code="NSE",
//                              order_id="20211116N100000023"))

// console.log(feed.get_order_detail(exchange_code="NFO",
//                              order_id="202111161100000284"))

// console.log(feed.get_order_list(exchange_code="NSE",
//                            from_date="2021-11-01T10:00:00.000Z",
//                            to_date="2021-11-30T10:00:00.000Z"))

// console.log(feed.order_cancellation(exchange_code="NSE",
//                                order_id="20211116N100000022"))

// console.log(feed.order_modification(order_id="202111241100000002",
//                                exchange_code="NFO",
//                                order_type="Limit",
//                                stoploss="0",
//                                quantity="250",
//                                price="290100",
//                                validity="Day",
//                                disclosed_quantity="0",
//                                validity_date="2021-12-30T06:00:00.000Z"))

//  console.log(feed.get_portfolio_holdings(exchange_code="NFO",
//                                    from_date="2021-11-01T06:00:00.000Z",
//                                    to_date="2021-11-30T06:00:00.000Z",
//                                    underlying="A",
//                                    portfolio_type=""))

// console.log(feed.get_portfolio_positions())

//  console.log(feed.get_quotes(stock_code="",
//                        exchange_code="NFO",
//                        expiry_date="2021-12-30T06:00:00.000Z",
//                        product_type="Futures",
//                        right="Others",
//                        strike_price="0"))

//  console.log(feed.square_off(source_flag="",
//                        order_stock_code="NIFTY",
//                        exchange_code="NFO",
//                        order_quantity="50",
//                        order_rate="0",
//                        order_flow="S",
//                        order_type="M",
//                        order_validity="T",
//                        order_stop_loss_price="0",
//                        order_disclosed_quantity="0",
//                        protection_percentage="",
//                        order_segment_code="",
//                        order_settlement="",
//                        margin_amount="",
//                        order_open_quantity="",
//                        order_cover_quantity="",
//                        order_product="F",
//                        order_exp_date="2021-12-30T06:00:00.000Z",
//                        order_exc_type="",
//                        order_option_type="",
//                        order_strike_price="0",
//                        order_trade_date="2021-12-16T06:00:00.000Z",
//                        trade_password="",
//                        order_option_exercise_type="*E"))

// console.log(feed.get_trade_list(from_date="2021-09-28T06:00:00.000Z",
//                            to_date="2021-11-15T06:00:00.000Z",
//                            exchange_code="NSE",
//                            product_type="",
//                            action="",
//                            stock_code=""))

// console.log(feed.get_trade_detail(exchange_code="NSE",
//                              order_id="20210928N100000067"))


// var SocketEventBreeze = function(breeze_instance){
//   var self = this;
//   self.url = 'https://uatstreams.icicidirect.com';
//   self.socket = null;
//   self.breeze_instance = breeze_instance

//   self.connect = function () {
//       self.socket = io.connect(self.url, {
//           auth: {
//               user: self.breeze_instance.userId,
//               token: self.breeze_instance.session_key
//           },
//           transports: ["websocket"],
//       });
//   };

//   self.watch = function (symbols) {
//       if (!self.socket) {
//           return;
//       } 
//       console.log("watching "+symbols);
//       self.socket.emit("join", symbols);
//       self.socket.on('stock', self.on_message)
//   };

//   self.on = function (callback) {
//       self.socket.on("stock", callback);
//   };

//   self.on_message = function(data){
//       data = self.parse_data(data);
//       self.on_ticks(data);
//   }

//   self.notify = function(){
//       self.socket.on('order', self.on_message)
//   }

//   self.unwatch = function (symbol) {
//       console.log("unwatched " + symbol);
//       self.socket.emit("leave", symbol);
//   };   

// }

// self.ws_connect = function(){
//     if (!self.sio_handler){
//         console.log(SocketEventBreeze({}));

//         self.sio_handler = new SocketEventBreeze(self);
//         self.sio_handler.connect();
//     }
// }

// self.ws_disconnect = function(){
//     if(!self.sio_handler)
//         self.sio_handler = new SocketEventBreeze(self)
//     self.sio_handler.on_disconnect()
// }