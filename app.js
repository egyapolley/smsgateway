const http = require("http");

const parser = require("fast-xml-parser");

const he = require("he");

const axios = require("axios");

const mysql = require("mysql2");

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



(async () =>{

    try {
        const messages = {}

        const pool = mysql.createPool({
            host: '172.25.37.23',
            user: 'polley',
            password: 'egy@poli123',
            database: 'smsNotification'
        });
        const promisePool = pool.promise();
        const [rows] = await promisePool.query("select * from Messages");
        rows.forEach(function (row) {
            messages[row.id] = row.MessageBody;
        });
        //console.log(messages);

        http.createServer((req, res) => {
            let alldata = ""
            req.on("data", chunk => {
                alldata += chunk

            });

            req.on("end", () => {

                let jsonObject = parser.parse(alldata, options);
                let soapBody = jsonObject.Envelope.Body.sendSMS.inputValues;
                console.log(soapBody)

                let to_msisdn = soapBody.phoneContact.toString();
                let messageId = soapBody.smsId.toString();
                let surflineNumber = soapBody.callingSubscriber.toString();
                let smsContent = (messages[messageId].replace("XXXXXX","0"+surflineNumber)).toString();

                const url = "http://api.hubtel.com/v1/messages/";

                const headers = {
                    "Content-Type": "application/json",
                    Authorization: "Basic Y3BlcGZ4Z2w6Z3Rnb3B0c3E="
                }


                let messagebody = {
                    Content: smsContent,
                    FlashMessage: false,
                    From: "Surfline",
                    To: to_msisdn,
                    Type:0,
                    RegisteredDelivery: true
                };

                axios.post(url, messagebody,
                    {headers: headers})
                    .then(function (response) {
                        console.log(response.data);
                        res.end("success")

                    }).catch(function (error) {
                    console.log(error);

                })





            });



        }).listen(5100, () => {
            console.log("App listening on port on 5100")
        })



    } catch (e) {

        console.log(e)
    }

})();

