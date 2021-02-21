const http = require("http");

const parser = require("fast-xml-parser");

const he = require("he");
const moment = require("moment");

const axios = require("axios");

const mysql = require("mysql2");

const soapRequest = require("easy-soap-request")

const options = {
    attributeNamePrefix: "@_",
    attrNodeName: "attr", //default is 'false'
    textNodeName: "#text",
    ignoreAttributes: true,
    ignoreNameSpace: true,
    allowBooleanAttributes: false,
    parseNodeValue: true,
    parseAttributeValue: false,
    trimValues: true,
    cdataTagName: "__cdata", //default is 'false'
    cdataPositionChar: "\\c",
    parseTrueNumberOnly: false,
    arrayMode: false,
    attrValueProcessor: (val, attrName) => he.decode(val, {isAttributeValue: true}),
    tagValueProcessor: (val, tagName) => he.decode(val),
    stopNodes: ["parse-me-as-string"]
};

const url = "http://api.hubtel.com/v1/messages/";
const headers = {
    "Content-Type": "application/json",
    Authorization: "Basic Y3BlcGZ4Z2w6Z3Rnb3B0c3E="
};

const sequelize = require("./sequeilze_dir/sql_database");
const SentSMS = require("./sequeilze_dir/sql_models");


const bundleIDMapping = {
    10:"1.6GB",
    11:"3.2GB",
    12:"5GB",
    13:"7GB",
    14:"12GB",
    15:"30GB",
    16:"45GB",
    17:"65GB",
    18:"120GB",
    19:"180GB",
    20:"Night Pack",
    21:"Unlimited Bundle",
    31:"Always ON Standard",
    32:"Always On Super",
    33:"Always ON Ultra",
    34:"Always ON Starter",
    35:"Always ON Streamer",
    36:"Always ON Lite",
    37:"Always ON Maxi",
    40:"SME Lite",
    41:"SME Standard",
    42:"SME Starter",
    43:"SME Super",
    44:"SME Ultra",
    50:"Ride ON Lite",
    51:"Ride ON",
    60:"Bolt Lite",
    61:"Bolt",
    70:"Weekend(10.5GB)"
};

(async () => {



    try {
        const messages = {}

        const pool = mysql.createPool({
            host: '172.25.33.141',
            user: 'mme',
            password: 'mme',
            database: 'smsNotification'
        });
        const promisePool = pool.promise();
        const [rows] = await promisePool.query("select * from Messages");
        rows.forEach(function (row) {
            messages[row.id] = row.MessageBody;
        });

        sequelize.sync({logging:false}).then(() =>console.log("Sequelize Connected"));
        http.createServer((req, res) => {
            let alldata = ""
            req.on("data", chunk => {
                alldata += chunk

            });

            req.on("end", async () => {

                try {

                    let jsonObject = parser.parse(alldata, options);
                    let soapBody = jsonObject.Envelope.Body.sendSMS.inputValues;


                    let to_msisdn = soapBody.phoneContact.toString();
                    let messageId = soapBody.smsId.toString();

                    let surflineNumber = soapBody.callingSubscriber.toString();
                    let smsContent = (messages[messageId].replace("XXXXXX", "0" + surflineNumber)).toString();


                    if (messageId === "5001") {
                        let smsDetail = soapBody.details.toString();
                        smsContent = smsContent.replace("CCCCCC", smsDetail)
                    }

                    if (["2001", "2002", "2003", "2004","2005","2006","2007","2008"].includes(messageId)) {
                        let smsType = soapBody.details.toString();
                        let msisdn = "233" + surflineNumber;
                        switch (messageId) {
                            case "2001":
                                let used_value;
                                const promo_balance = await getPromoBalance(msisdn);
                                if (promo_balance) {
                                    let current_balance = parseFloat(promo_balance.value);
                                    used_value = ((51200 - current_balance)/1024.0).toFixed(3);

                                } else {
                                    used_value = 50;
                                }
                                smsContent = smsContent.replace("UUUUUU",`${used_value}`);
                                break;

                            case "2002":
                                console.log(msisdn)
                                let bundleName = await getBundlePurchased(msisdn);
                                if (!bundleName) bundleName ="a";
                                smsContent = smsContent.replace("BBBBBB",`${bundleName}`);
                                break;
                            case "2004":
                                const promo_balance2 = await getPromoBalance(msisdn);
                                let expiry_date = promo_balance2 && promo_balance2.expiry_date?promo_balance2.expiry_date:"";
                                smsContent = smsContent.replace(/DDDDDD/g, expiry_date);
                                break;
                            case "2006":
                                const date =moment().format("DD-MM-YYYY");
                                smsContent = smsContent.replace("DD-MM-YYYY", date);
                                break;
                            case "2008":
                                let smsData = soapBody.data.toString();
                                smsContent=smsContent.replace(/YYYYYY/g,`${smsData}`)
                                break;
                        }

                        await pushSMS_Save(smsContent, to_msisdn, res,msisdn,smsType)

                    }else {
                        pushSMS(smsContent, to_msisdn, res)

                    }



                }catch (error) {
                    console.log(error);
                    res.end("success")

                }

            });


        }).listen(5100, () => {
            console.log("App listening on port on 5100")
        })


    } catch (e) {

        console.log(e)
    }

})()


function pushSMS(smsContent, to_msisdn, res) {
    let messagebody = {
        Content: smsContent,
        FlashMessage: false,
        From: "Surfline",
        To: to_msisdn,
        Type: 0,
        RegisteredDelivery: true
    };

    axios.post(url, messagebody,
        {headers: headers})
        .then(function (response) {
            console.log(response.data);
            res.end("success")

        }).catch(function (error) {
        console.log(error);
        res.end("success")

    })

}

async function pushSMS_Save(smsContent, to_msisdn, res, surflineNumber, smsType) {
    let messagebody = {
        Content: smsContent,
        FlashMessage: false,
        From: "Surfline",
        To: to_msisdn,
        Type: 0,
        RegisteredDelivery: true
    };

    axios.post(url, messagebody,
        {headers: headers})
        .then(function (response) {
            console.log(response.data);
            let MessageId =response.data && response.data.MessageId?response.data.MessageId:null;
            SentSMS.create({surflineNumber,smsType,smsContent,phoneContact: to_msisdn,MessageId}).then(sentSMS =>{
                res.end("success")
            }).catch(error =>{
                console.log(error)
                res.end("success")

            })

        }).catch(function (error) {
        console.log(error);
        res.end("success")

    })

}

async function getPromoBalance(subscriberNumber) {

    const url = "http://172.25.33.141:7000/account";
    const headers = {"Content-Type": "application/json"}

    try {
        let body = {
            subscriberNumber,
            channel: "CHATAPP"
        };

        const response = await axios.get(url, {
            headers, auth: {
                username: "chat",
                password: "chat1234"
            },
            data: body
        });
        if (response) {

            const {data} = response;
            if (data.account_balance && data.account_balance.data_balance) {
                const data_balances = data.account_balance.data_balance;
                for (const dataBalance of data_balances) {
                    if (dataBalance.balance_type === 'Promotional Data') {
                        return dataBalance;
                    }

                }

                return null;


            }


        }

    } catch (error) {
        console.log(error);
        return null;


    }


}

async function getBundlePurchased(subscriberNumber) {

    try {
        const soapUrl = "http://172.25.39.13:3004";
        const soapHeaders = {
            'User-Agent': 'NodeApp',
            'Content-Type': 'text/xml;charset=UTF-8',
            'SOAPAction': 'urn:CCSCD1_QRY',
        };

        let getBalancexml = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:pi="http://xmlns.oracle.com/communications/ncc/2009/05/15/pi">
   <soapenv:Header/>
   <soapenv:Body>
      <pi:CCSCD1_QRY>
         <pi:username>admin</pi:username>
         <pi:password>admin</pi:password>
         <pi:MSISDN>${subscriberNumber}</pi:MSISDN>
         <pi:LIST_TYPE>BALANCE</pi:LIST_TYPE>
         <pi:WALLET_TYPE>Primary</pi:WALLET_TYPE>
         <pi:BALANCE_TYPE>internalBdlId Count</pi:BALANCE_TYPE>
      </pi:CCSCD1_QRY>
   </soapenv:Body>
</soapenv:Envelope>`;

        const {response} = await soapRequest({url: soapUrl, headers: soapHeaders, xml: getBalancexml, timeout: 6000}); // Optional timeout parameter(milliseconds)
        const {body} = response;
        let jsonObj = parser.parse(body, options);
        const soapResponseBody = jsonObj.Envelope.Body;
        if (soapResponseBody.CCSCD1_QRYResponse && parseInt(soapResponseBody.CCSCD1_QRYResponse.BALANCE.toString()) > 0) {
            let bundleId =  parseInt(soapResponseBody.CCSCD1_QRYResponse.BALANCE.toString());
            return bundleIDMapping[bundleId]?bundleIDMapping[bundleId]:null;
        } else {
            return null;
        }

    } catch (error) {
        console.log(error);
        return null;

    }

}
