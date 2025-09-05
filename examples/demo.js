//make sure you have latest package of breezeconnect installed. 
// shell command -> npm i breezeconnect

//import library
var BreezeConnect = require('breezeconnect').BreezeConnect;

// intialize keys
const API_KEY = "INSERT_YOUR_APP_KEY_HERE";
const API_SECRET = "INSERT_YOUR_SECRET_KEY_HERE";
const API_SESSION = "INSERT_YOUR_API_SESSION_HERE";

var breeze = new BreezeConnect({'appKey' : API_KEY});

breeze.generateSession(API_SECRET,API_SESSION).then(function(resp){

  // call function containing api calls
  api_calls();

}).catch(function(err){
    console.log(err)
});


function api_calls(){
  // This function houses API calls. Below is example of option chain API
  
    breeze.getOptionChainQuotes(
        {
            stockCode:"NIFTY",
            exchangeCode:"NFO",
            productType:"options",
            expiryDate:"2023-01-25T06:00:00.000Z",
            right:"call",
            strikePrice:"18000"
        }
    ).then(function(resp){console.log(resp);})

}
