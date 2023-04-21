const AWS: any = require("aws-sdk");
const schemaValidator: any = require("jsonschema").Validator;
const express: any = require("express");
const serverless: any = require("serverless-http");
const cors: any = require("cors");
const { OAuth2Client } = require('google-auth-library');

const dynamoDbClient: any = new AWS.DynamoDB.DocumentClient();
const google_client: any = new OAuth2Client(process.env.CLIENT_ID);
AWS.config.update(
    {
        region: process.env.REGION
    });
const db_schema: any = require("./" + process.env.JSCHEMA);   /// <--- reference to the original form schema that works for both the webpage and the server side validation
const app: any = express();
const DATA_TABLE: string = process.env.DATA_TABLE!;
const STORAGE_BUCKET: string = process.env.STORAGE_BUCKET!;
const s3: any = new AWS.S3();
const debug: boolean = true;
const signedUrlExpireSeconds: number = 60 * 5; //Link Expires in 5 minutes
import { Request, Response, NextFunction } from "express";
const fs = require('fs');
const pathJsonData = fs.readFileSync('./test/paths.json', 'utf-8');
const pathJsonObject: JSON = JSON.parse(pathJsonData);

interface GetParams {
    TableName: string;
    FilterExpression?: string;
    ExpressionAttributeValues: {
        ":uid": string;
    } | {
        ":email": { S: string };
    } | {
        ":email": { S: string };
        ":uid": { S: string };
    };
}

interface PutParams {
    TableName: string;
    Item: any;
}

interface ValidationResult {
    valid: boolean;
    errors: Array<{
        property: string;
        message: string;
    }>;
}

function debuglog(str: string) {
    if (debug) {
        console.log(str);
    }
}

function validateSchema(instance: any): ValidationResult {
    var v: any = new schemaValidator();
    var validation_result: ValidationResult = v.validate(instance, db_schema);
    return validation_result;
}

app.use(express.json({ limit: '20MB' })); //To enable larger file upload upto 20M
app.use(cors());

app.post("/heartbeat", async function (req: Request, res: Response) {
    res.status(200).json(
        {
            status: "heartbeat"
        });
});

app.post("/setExperiment", async function (req: Request, res: Response) {
        try {
            const ticket: any = await google_client.verifyIdToken(
                {
                    idToken: req.body.jwtToken.credential,
                    audience: process.env.CLIENT_ID
                })
                .catch(function (err) {
                    debuglog("Failed to Validate");
                    debuglog(JSON.stringify(err));
                    res.status(401).json({ error: "Unauthorized by Google" });
                });
        }
        catch
        {
            return res.status(401).json({ error: "Unauthorized" });
        }
    
    var instance: any = req.body;
    debuglog(`Instance: ${instance}`);
    debuglog(JSON.stringify(instance));
    var validation_result: ValidationResult = validateSchema(instance);
    if (validation_result.valid) {
        debuglog("Validation Success");
        try {
            var uid: string = "";
            var unique: boolean = false;
            var putParams: PutParams = {
                TableName: "Null Table",
                Item: {}
            };
            while (!unique) {
                uid = Math.random().toString(26).slice(-2).toUpperCase() + String(Date.now()).slice(-3);
                debuglog("Computed expid:" + uid);
                //Check if the generated uid is genuinely expid (i.e not exisiting in the database)
                const getParams: GetParams = {
                    TableName: DATA_TABLE,
                    FilterExpression: "email = :email and uid = :uid",
                    ExpressionAttributeValues:
                    {
                        ":email": { S: req.body.email },
                        ":uid": { S: uid }
                    }
                };


                const Item = await dynamoDbClient.scan(getParams).promise().then(
                    getData => {
                        if (getData.Count == 0) {

                            instance.uid = String(uid);
                            unique = true;
                            putParams = {
                                TableName: DATA_TABLE,
                                Item: instance,
                            };
                        }
                    }
                );
            }
            if (pathJsonObject.hasOwnProperty("paths")) {
                const pathFile = pathJsonObject["paths"];
                for (const key in pathFile) {
                    if (pathFile.hasOwnProperty(key)) {
                        const pathArray = pathFile[key];
                        let obj: any = instance; // Start with the root object "instance"

                        var path: string;
                        // Dynamically access the objects in "instance" based on the keys and array values in "paths"
                        var s3Key: string = String(uid);
                        for (let i = 0; i < pathArray.length; i++) {
                            path = pathArray[i];
                            obj = obj[path]; // Access the nested object using the current array value as the key
                            s3Key += "/" + path;
                        }

                        // "obj" now contains the desired nested object in "instance"
                        //do something with obj!

                        var fileData;
                        debuglog("obj type: " + typeof obj);
                        fileData = obj;

                        if (String(fileData) !== "") {
                            var headerEnd: number = fileData.indexOf(';');
                            var base64Data: string = fileData.substring(headerEnd + 1);
                            var fileBody: Buffer = Buffer.from(base64Data, 'base64');

                            await s3.upload({
                                Bucket: STORAGE_BUCKET,
                                Key: s3Key,
                                ContentEncoding: 'base64',
                                Body: fileBody
                            }).promise()
                                .then(function (data) {
                                    debuglog("Successfully Upload s3");
                                    debuglog(JSON.stringify(data));

                                    let newObj: any = instance; // Start with the root object "instance"
                                    var path: string;
                                    // Dynamically access the objects in "instance" based on the keys and array values in "paths"
                                    for (let i = 0; i < pathArray.length - 1; i++) {
                                        path = pathArray[i];
                                        newObj = newObj[path]; // Access the nested object using the current array value as the key
                                    }
                                    newObj[pathArray[pathArray.length - 1]] = "true";
                                })
                                .catch(function (err) {
                                    if (err) {
                                        debuglog("Failed Upload s3");
                                        debuglog(JSON.stringify(err));
                                    }
                                }
                                );
                        }

                        let newobj: any = instance;
                        for (let i = 0; i < pathArray.length; i++) {
                            path = pathArray[i];
                            newobj = newobj[path]; // Access the nested object using the current array value as the key
                        }
                        debuglog(`Object for ${key}:` + newobj);
                    }
                }

            }

            // Iterate through the keys in "paths" object
            debuglog("Put Parameters to DB :");
            debuglog(JSON.stringify(putParams));
            dynamoDbClient.put(putParams).promise()
                .then(function (data) {
                    debuglog("Success");
                    debuglog(JSON.stringify(data));
                })
                .catch(function (err) {
                    debuglog("DynamoDBClient put Failure");
                    debuglog(JSON.stringify(err));
                });

            res.status(200).json(
                {
                    uid: uid
                });
        }
        catch (err) {
            debuglog(JSON.stringify(err));
            res.status(500).json(
                {
                    error: "Could not create user"
                });
        }
    }
    else {
        debuglog("Validation Error");
        debuglog(JSON.stringify(validation_result.errors));
        res.status(400).json(
            {
                error: "Validation Error",
                validation_result: validation_result.errors
            });
    }
    res.end()
});

app.post("/getByEmail", async function (req: Request, res: Response) {
        try {
            const ticket: any = await google_client.verifyIdToken(
                {
                    idToken: req.body.jwtToken.credential,
                    audience: process.env.CLIENT_ID
                })
                .catch(function (err) {
                    debuglog("Failed to Validate");
                    debuglog(JSON.stringify(err));
                    res.status(401).json({ error: "Unauthorized by Google" });
                });
        }
        catch
        {
            res.status(401).json({ error: "Unauthorized" });
        }
    const getParams: GetParams = {
        TableName: DATA_TABLE,
        FilterExpression: "email = :email",
        ExpressionAttributeValues:
        {
            ":email": req.body.email
        }
    }
    try {
        const Item = await dynamoDbClient.scan(getParams).promise().then(
            data => {
                if (data.Count > 0) {
                    debuglog("getByEmail: Data Count1: " + data.Count)
                    for (var i: number = 0; i < data.Count; i++) {
                        debuglog(JSON.stringify(data.Items[i]));
                        debuglog("After stringify");
                        if (pathJsonObject.hasOwnProperty("paths")) {
                            debuglog("pathJsonObject has paths");
                            const pathFile = pathJsonObject["paths"];
                            debuglog("Accessing each key in json object");
                            for (const key in pathFile) {
                                debuglog("for each key");
                                if (pathFile.hasOwnProperty(key)) {
                                    debuglog("path has key");
                                    const pathArray = pathFile[key];
                                    let obj: any = data.Items[i]; // Start with the root object "instance"
                                    let prevObj: any;
                                    var path: string;
                                    // Dynamically access the objects in "instance" based on the keys and array values in "paths"
                                    var fileKey: string = String(obj.uid);
                                    for (let j = 0; j < pathArray.length; j++) {
                                        path = pathArray[j];
                                        obj = obj[path]; // Access the nested object using the current array value as the key
                                        fileKey += '/' + path;
                                    }

                                    //do something with obj
                                    debuglog("obj: " + obj);
                                    if (obj === "true") {
                                        //create signed URL
                                        debuglog("Accessing each key in json object");
                                        var signedURL: any;
                                        if (fileKey.includes("audio"))
                                            signedURL = s3.getSignedUrl('getObject', { Bucket: STORAGE_BUCKET, Key: fileKey, Expires: signedUrlExpireSeconds, ResponseContentType: "audio/wav", ResponseContentDisposition: 'attachment; filename ="' + fileKey + '.wav"' });
                                        else
                                            signedURL = s3.getSignedUrl('getObject', { Bucket: STORAGE_BUCKET, Key: fileKey, Expires: signedUrlExpireSeconds });
                                        debuglog("Signed URL: " + signedURL);

                                        let newObj: any = data.Items[i]; // Start with the root object "instance"
                                        var path: string;
                                        // Dynamically access the objects in "instance" based on the keys and array values in "paths"
                                        for (let i = 0; i < pathArray.length - 1; i++) {
                                            path = pathArray[i];
                                            newObj = newObj[path]; // Access the nested object using the current array value as the key
                                        }
                                        newObj[pathArray[pathArray.length - 1]] = signedURL;//this doesn't work
                                    }
                                }
                            }
                        }
                    }

                    debuglog("getbyEmail Data Count2: " + data.Count)
                    res.json(data.Items);
                }
                else {
                    res.status(404).json(
                        {
                            error: "Could not find user with provided email"
                        });
                }
            }
        );
    }
    catch (err) {
        res.status(500).json(
            {
                error: "Could not retreive user",
                errorString: err
            });

    }
});




app.post("/getById", async function (req: Request, res: Response) {
    const getParams: GetParams = {
        TableName: DATA_TABLE,
        FilterExpression: "uid = :uid",
        ExpressionAttributeValues:
        {
            ":uid": req.body.uid.toString().toUpperCase()
        }
    }
    try {
        const Item = await dynamoDbClient.scan(getParams).promise().then(
            data => {
                if (data.Count > 0) {
                    debuglog("getById: Data Count1: " + data.Count)
                    for (var i: number = 0; i < data.Count; i++) {
                        debuglog(JSON.stringify(data.Items[i]));
                        debuglog("After stringify");
                        if (pathJsonObject.hasOwnProperty("paths")) {
                            debuglog("pathJsonObject has paths");
                            const pathFile = pathJsonObject["paths"];
                            debuglog("Accessing each key in json object");
                            for (const key in pathFile) {
                                debuglog("for each key");
                                if (pathFile.hasOwnProperty(key)) {
                                    debuglog("path has key");
                                    const pathArray = pathFile[key];
                                    let obj: any = data.Items[i]; // Start with the root object "instance"
                                    var path: string;
                                    // Dynamically access the objects in "instance" based on the keys and array values in "paths"
                                    var fileKey: string = String(obj.uid);
                                    for (let j = 0; j < pathArray.length; j++) {
                                        path = pathArray[j];
                                        obj = obj[path]; // Access the nested object using the current array value as the key
                                        fileKey += '/' + path;
                                    }

                                    //do something with obj
                                    debuglog("obj: " + obj);
                                    if (obj === "true") {
                                        //create signed URL
                                        debuglog("Accessing each key in json object");
                                        var signedURL: any;
                                        if (fileKey.includes("audio"))
                                            signedURL = s3.getSignedUrl('getObject', { Bucket: STORAGE_BUCKET, Key: fileKey, Expires: signedUrlExpireSeconds, ResponseContentType: "audio/wav", ResponseContentDisposition: 'attachment; filename ="' + fileKey + '.wav"' });
                                        else
                                            signedURL = s3.getSignedUrl('getObject', { Bucket: STORAGE_BUCKET, Key: fileKey, Expires: signedUrlExpireSeconds });
                                        debuglog("Signed URL: " + signedURL);

                                        let newObj: any = data.Items[i]; // Start with the root object "instance"
                                        var path: string;
                                        // Dynamically access the objects in "instance" based on the keys and array values in "paths"
                                        debuglog("Before assigned signed url");
                                        debuglog("Path size: " + pathArray.length);

                                        for (let i = 0; i < pathArray.length - 1; i++) {
                                            debuglog("crash?");
                                            path = pathArray[i];
                                            newObj = newObj[path]; // Access the nested object using the current array value as the key
                                        }
                                        debuglog("Before assigned signed url");
                                        newObj[pathArray[pathArray.length - 1]] = signedURL;//this doesn't work
                                        debuglog("Assigned signed url");
                                    }
                                }
                            }
                        }
                    }

                    debuglog("getbyId Data Count2: " + data.Count)
                    res.json(data.Items);
                }
                else {
                    res.status(404).json(
                        {
                            error: "Could not find user with provided Id"
                        });
                }
            }
        );
    }
    catch (err) {
        res.status(500).json(
            {
                error: "Could not retreive user",
                errorString: err
            });

    }
});


app.use((req: Request, res: Response, next: NextFunction) => {
    return res.status(404).json(
        {
            error: "Not Found",
        });
});

module.exports.handler = serverless(app);