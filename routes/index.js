var express = require('express');
var router = express.Router();
var axios = require('axios');
var crypto = require('crypto');
var moment = require('moment'); // require

//ZOHO
const CLIENT_ID= "1000.FNX9Y6ZAAIK556QGX8RK8H8NCXKSSS"
const CLIENT_SECRET= "e2b9c1f80aa5e07273ca8f1492f02baa7408064f8f"
// const CLIENT_ID= "1000.B23R4ROGMBQ8X2M8MG7E21ZGNGBZQG"
// const CLIENT_SECRET= "69cecf985280c85355edab462d610cf621a072c8d7"
// const MAIN_URL= "http://localhost:3000"
// const REDIRECT_URL= "http://localhost:3000/token"
const MAIN_URL= "https://payfort-zoho.herokuapp.com"
const REDIRECT_URL= "https://payfort-zoho.herokuapp.com/token"
const querystring = require('querystring');
const CUSTOMFIELD_ID= "2290844000000703035"
// const CUSTOMFIELD_ID= "886673000005162005"
const REFRESH_TOKEN= "1000.7059596eb4520d92c2da9e9eb4caa02e.11b9d3181e9ab0ff6341a4cec75063ef"


//PAYFORT
let live= true;
let access_code= "EN8jGDZpDQZBZGxibMKr";
let merchant_identifier= 'b474b256';
let merchant_reference= "";
let SHA_request_phrase= '$2y$10$YCZnMV2p6';
let SHA_response_phrase= '$2y$10$b9ZOnWXy3';
let signature= "";
let shaString  = '';
let redirectUrl = 'https://sbcheckout.payfort.com/FortAPI/paymentPage';

if(live){
  redirectUrl = 'https://checkout.payfort.com/FortAPI/paymentPage';
  access_code= "xbmtPp9Q4KEhfEfJUSUG";
  merchant_identifier= 'xyKdBdwl';
  SHA_request_phrase= '$2y$10$A80vhiZm/';
  SHA_response_phrase= '$2y$10$OOT/5mN8c';
}





router.get('/', function(req, res, next) {
  res.render('accept', {
    scope: "ZohoBooks.fullaccess.all",
    client_id: CLIENT_ID,
    response_type: "code",
    state: 'code',
    access_type: 'offline',
    redirect_uri: REDIRECT_URL
  });
});

router.get('/token', function(req, res, next) {
  let code = req.query.code;
  let state = req.query.state;
  console.log("=================")
  console.log("State ", state)
  console.log("code ", code)
  console.log("=================")
  axios.post("https://accounts.zoho.com/oauth/v2/token", querystring.stringify({
    // code: code,
    refresh_token: REFRESH_TOKEN,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URL,
    grant_type: "refresh_token",
    // grant_type: "authorization_code",
    scope: "ZohoBooks.fullaccess.all",
    state: 'token'
  }), ).then(response => {
    let token= response.data.access_token
    console.log(response.data)
    if(state == "code"){
      axios.get("https://books.zoho.com/api/v3/organizations", {
        headers: {
          'Authorization': 'Zoho-oauthtoken '+token,
        }
      }).then(response => {
        res.render('invoice', {
          token,
          organizations: response.data.organizations
        })
      })
    }else{
      res.redirect('/invoice/'+state.replace("__", "=")+"&token="+token)
    }
  }).catch(err => {
    console.log(err)
    res.send("error")
  })
});
router.get('/generate', function(req, res, next) {
  let token = req.query.token;
  let organization_id = req.query.organization_id;
  let invoice_number = req.query.invoice_number;
  axios.get("https://books.zoho.com/api/v3/invoices", {
    params: {
      organization_id,
      invoice_number
    },
    headers: {
      'Authorization': 'Zoho-oauthtoken '+token,
    }
  }).then(response => {
    let invoice= response.data.invoices[0]
    axios.put("https://books.zoho.com/api/v3/invoices/"+invoice.invoice_id, {
      customer_id: invoice.customer_id,
      custom_fields: [
        {
          customfield_id: CUSTOMFIELD_ID,
          value: MAIN_URL+"/invoice/"+invoice.invoice_id+"?organization_id="+organization_id
        }
      ],
    }, {
      params: {
        organization_id
      },
      headers: {
        'Authorization': 'Zoho-oauthtoken '+token,
      }
    }).then(response => {
      res.send("Done")
    }).catch(err => {
      res.send("Error")
    })
  }).catch(err => {
    res.send("Error")
  })
});
router.get('/complete/:invoiceId', function(req, res, next) {
  let invoiceId= req.params.invoiceId
  let organization_id = req.query.organization_id;
  let token = req.query.token;
  let response_message = req.query.response_message;
  let fort_id = req.query.fort_id;
  let amount = req.query.amount/100;
  // res.send(req.query)
  if(response_message == "Success"){
    axios.get("https://books.zoho.com/api/v3/invoices/"+invoiceId, {
      params: {
        organization_id,
      },
      headers: {
        'Authorization': 'Zoho-oauthtoken '+token,
      }
    }).then(response => {
      let invoice= response.data.invoice
      axios.post("https://books.zoho.com/api/v3/customerpayments", {
        customer_id: invoice.customer_id,
        payment_mode: "creditcard",
        amount: amount,
        reference_number: fort_id,
        description: fort_id,
        invoices: [
          {
            "invoice_id": invoiceId,
            "amount_applied": amount
          }
        ],
        date: moment().format("Y-MM-DD"),
      }, {
        params: {
          organization_id
        },
        headers: {
          'Authorization': 'Zoho-oauthtoken '+token,
        }
      }).then(response => {
        res.send("Successfully Paid")
      }).catch(err => {
        res.send(err.response.data)
      })
    }).catch(err => {
      res.send("Failed")
    })
  }else{
    res.send("Failed")
  }
});

router.get('/invoice/:invoiceId', function(req, res, next) {
  let invoiceId= req.params.invoiceId
  let organization_id = req.query.organization_id;
  let token = req.query.token;
  if(!token){
    res.render('accept', {
      scope: "ZohoBooks.fullaccess.all",
      client_id: CLIENT_ID,
      response_type: "code",
      state: invoiceId+"?organization_id__"+organization_id,
      redirect_uri: REDIRECT_URL
    });
  }else{
    axios.get("https://books.zoho.com/api/v3/invoices/"+invoiceId, {
      params: {
        organization_id
      },
      headers: {
        'Authorization': 'Zoho-oauthtoken '+token,
      }
    }).then(response => {
      let invoice= response.data.invoice
      let shaString= ""
      let unordered= {
        'command': 'AUTHORIZATION',
        'access_code': access_code,
        'merchant_identifier': merchant_identifier,
        'merchant_reference': Date.now(),
        'amount': invoice.balance*100,
        'currency': invoice.currency_code,
        'language': 'en',
        'customer_email': "karim.elbadry2@gmail.com",
        'order_description': invoice.invoice_number,
        'return_url': MAIN_URL+"/complete/"+invoiceId+"?organization_id="+organization_id+"&token="+token,
      }
      let ordered = {};
      Object.keys(unordered).sort().forEach(function(key) {
        ordered[key] = unordered[key];
      });
      for (const property in ordered) {
        shaString += `${property}=${ordered[property]}`;
      }
      shaString = SHA_request_phrase + shaString + SHA_request_phrase;
      ordered.signature = crypto.createHash('sha256').update(shaString).digest("hex");
      // res.send(ordered)
      res.render('form', {
        ...ordered,
        invoiceId,
        'redirect_url': redirectUrl
      });
    }).catch(err => {
      res.send("Error")
    })
  }
});

module.exports = router;
