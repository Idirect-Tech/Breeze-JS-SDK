const axios = require('axios');

var hostname = "https://api.icicidirect.com/breezeapi/api/v1/";
var endpoint = "customerdetails";

var header = {"Content-Type":"application/json"
}

body = {"SessionToken":"INSERT_YOUR_API_SESSION_HERE",
        "AppKey":"INSERT_YOUR_APP_KEY_HERE"
    }

var methodtype = "get"
var url = hostname + endpoint;

async function run(){
    res = await axios(
        {
            method:methodtype,
            url:url,
            data:body,
            headers:header
        }).then((resp)=>{return resp})

        console.log(res['data']);
    }

run();
