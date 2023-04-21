import * as fs from "fs";
import * as path from "path";
import { faker } from "@faker-js/faker";
import { compileFromFile } from "json-schema-to-typescript"; 
//import { Input as schemaType } from "../schemaType";

// Define path of JSONSchema and UISchema
const UISchemaFilePath = path.join(__dirname, "../" + process.env.UISCHEMA);
const JSchemaFilePath = path.join(__dirname, "../" + process.env.JSCHEMA);
const UISchema = JSON.parse(fs.readFileSync(UISchemaFilePath, "utf8"));
const JSchema = JSON.parse(fs.readFileSync(JSchemaFilePath, "utf8"));
var pathsCount = 0;
var paths: JsonObject = {} as JsonObject;
var pathsWithFileExtension: JsonObject = {} as JsonObject;

// Globals to keep track of file path and array indicies for creating file path json.
var globalObjectPath: Object[] = [];
var globalFromArray = false;
var arrayCounter = 0;

// Generate type from
const schemaType = compileFromFile(JSchemaFilePath);
compileFromFile(JSchemaFilePath).then(ts => fs.writeFileSync('schemaType.d.ts', ts));

// Type interface for UISchema
interface JsonObject {
  [key: string]: any;
}

// Parses the UISchema to find the file type of a given property
function parseUISchema(
  uiSchema: JsonObject,
  property: string
): string | undefined {
  for (const key in uiSchema) {
    if (key === property) {
      if (uiSchema[property].hasOwnProperty("ui:options")) {
        const options: JsonObject = uiSchema[property]["ui:options"];
        if (options.hasOwnProperty("accept")) {
          const fileType: string = options["accept"];
          return fileType;
        }
      }
    }
    if (typeof uiSchema[key] === "object") {
      const fileType: string | undefined = parseUISchema(
        uiSchema[key],
        property
      );
      if (fileType !== undefined) {
        return fileType;
      }
    }
  }
  return undefined;
}

// Set a given value of the sample request.
function addPropertyNested(
  path: Object[],
  value: any,
  request: JsonObject
): void {
  var pathSlice: Object[] = path.slice();
  const finalKey = pathSlice.pop();
  const nestedObject = pathSlice.reduce((nestedObj, key) => {
    if (typeof key === "string") {
      if (nestedObj[key] === undefined) {
        nestedObj[key] = {};
      }
      return nestedObj[key] as typeof schemaType;
    }
  }, request);

  if (value instanceof Array && value.length === 1) {
    nestedObject[finalKey as string] = [value[0]];
  } 
  else if (globalFromArray) {
    nestedObject[finalKey as string] = [];
    for (var i = 0; i < value.length; i++)
      nestedObject[finalKey as string].push(value[i]);
  }
  else nestedObject[finalKey as string] = value;
}

// Create a dummy string given a JSONSchema object
// TODO: Add more format support
function createString(path: Object[], value: JsonObject): string {
  if (value.hasOwnProperty("format") && value["format"] === "uri-reference") {
    return faker.internet.domainName();
  } else if (value.hasOwnProperty("format") && value["format"] === "data-url") {
    // Add path of this file to paths.json
    
    pathsCount++;
    const property: string = path.pop() as string;
    var fileType: string | undefined = parseUISchema(UISchema, property);
    if (fileType === undefined) fileType = ".txt";
    // construct the data URL
    const dataURL = `data:dummy/dummy;name=dummy${fileType};base64,blahblahblah=`;
    path.push(property);
    if (globalFromArray) {
        path.push(arrayCounter);
        addPropertyNested(["paths", "path" + pathsCount], globalObjectPath.concat(path), paths);
        addPropertyNested(["paths", "path" + pathsCount], globalObjectPath.concat(path).concat(fileType), pathsWithFileExtension);
        path.pop();
      } else addPropertyNested(["paths", "path" + pathsCount], globalObjectPath.concat(path), paths);
      addPropertyNested(["paths", "path" + pathsCount], globalObjectPath.concat(path).concat(fileType), pathsWithFileExtension);
    return dataURL;
  } else {
    return faker.word.noun();
  }
}

// Create a dummy number given a JSONSchema object
// TODO: Add more format support
function createNumber(value: JsonObject): number {
  return faker.datatype.number();
}

// Create a dummy integer given a JSONSchema object
// TODO: Add more format support
function createInteger(value: JsonObject): number {
  if (value.hasOwnProperty("default")) return value["default"];
  if (value.hasOwnProperty("minimum")) return value["minimum"];
  if (value.hasOwnProperty("maximum")) return value["maximum"];

  return faker.datatype.number();
}

// Create a dummy boolean given a JSONSchema object
// TODO: Add more format support
function createBoolean(value: JsonObject): boolean {
  return faker.datatype.boolean();
}

// Create a dummy array given a JSONSchema object
// TODO: Add more format support
function createArray(path: Object[], value: JsonObject): any[] {
  var entryArray: any = [];
  if (value.hasOwnProperty("items")) {
    const items: JsonObject = value["items"];
    if (items.hasOwnProperty("type")) {
      var type = value["items"]["type"];
    }
    var numberOfItems = 1;
    if (value.hasOwnProperty("minItems")) {
      numberOfItems = value["minItems"];
    }
    for (let i = 0; i < numberOfItems; i++) {
      if (type === "string") {
        globalFromArray = true;
        arrayCounter = i;
        entryArray.push(createString(path, items));
        globalFromArray = false;
      }
      if (type === "number") entryArray.push(createNumber(items));
      if (type === "integer") entryArray.push(createInteger(items));
      if (type === "boolean") entryArray.push(createBoolean(items));
      if (type === "object") {
        var propertyPath: Object[] = [];
        globalFromArray = true;
        arrayCounter = i;
        globalObjectPath.push(path[path.length-1]);
        entryArray.push(parseJSONSchema(items, propertyPath));
        globalObjectPath.pop();
        globalFromArray = false;

      }
    }
  }
  return entryArray;
}

// Create a dummy enum selection given a JSONSchema object
function createEnum(path: Object[], value: JsonObject): any {
  return value["enum"][0];
}

// Parse a JSONSchema and create sample values for each entry. Then call a function to add it to the sampleRequest object.
function parseJSONSchema(JSchema: JsonObject, path: Object[]): JsonObject {
  var schema: JsonObject = {} as JsonObject;
  if (JSchema.properties) {
    for (const key in JSchema.properties) {
      const value: JsonObject = JSchema.properties[key];
      if (value.hasOwnProperty("type")) {
        const type = value["type"];

        // If object, recurse it.
        if (type === "object") {
          path.push(key);
          globalObjectPath.push(key);
          var propertyPath: Object[] = [];

          addPropertyNested(path, parseJSONSchema(value, propertyPath), schema);
          path.pop();
          globalObjectPath.pop();
        }
        // If enum, select the first enum
        else if (value.hasOwnProperty("enum")) {
          path.push(key);
          addPropertyNested(path, createEnum(path, value), schema);
          path.pop();
        }
        // If array, generate random array
        else if (type === "array") {
          path.push(key);
          addPropertyNested(path, createArray(path, value), schema);
          path.pop();
        }
        // If string, generate random string
        else if (type === "string") {
          path.push(key);
          addPropertyNested(path, createString(path, value), schema);
          path.pop();
        }
        // If number, generate random number (with restrictions)
        else if (type === "number") {
          path.push(key);
          addPropertyNested(path, createNumber(value), schema);
          path.pop();
        }
        // If integer, generate random integer (with restrictions)
        else if (type === "integer") {
          path.push(key);
          addPropertyNested(path, createInteger(value), schema);
          path.pop();
        }
        // If boolean, generate random boolean
        else if (type === "boolean") {
          path.push(key);
          addPropertyNested(path, createBoolean(value), schema);
          path.pop();
        }
      }
    }
  }
  return schema;
}

// Function to complete the sample request by adding necessary values not present in JSONSchema.
function addDefaultInfo(request: JsonObject) {
  addPropertyNested(["email"], "test@test.com", request);
  addPropertyNested(["jwtToken", "clientId"], "token", request);
  addPropertyNested(["jwtToken", "credential"], "token", request);
  addPropertyNested(["jwtToken", "select_by"], "user", request);
}

function main() {
  // Parse JSONSchema and create sample response
  var propertyPath: Object[] = [];

  var request: JsonObject = parseJSONSchema(JSchema, propertyPath);
  addDefaultInfo(request);

  // Write the sampleRequest to a file named 'sampleRequest.json'
  fs.writeFile("test/sampleRequest.json", JSON.stringify(request), (err) => {
    if (err) {
      console.error(err);
    }
  });

  // Write the paths to a file names 'paths.json'
  fs.writeFile("test/paths.json", JSON.stringify(paths), (err) => {
    if (err) {
      console.error(err);
    }
  });

  // Write the paths to a file names 'pathsWithFile.json'
  fs.writeFile("test/pathsWithFile.json", JSON.stringify(pathsWithFileExtension), (err) => {
    if (err) {
      console.error(err);
    }
  });

  const GOOG_CLIENT_ID = process.env.GOOG_CLIENT_ID;
  const ENDPOINT = process.env.ENDPOINT;

  const inputFile = 'client/dist/assets/server.js';
  const outputFile = 'client/dist/assets/server.js';

  fs.readFile(inputFile, 'utf8', (err, data) => {
    if (err) throw err;
    
    var modifiedData = data.replace(/const GOOG_CLIENT_ID = ""/, `const GOOG_CLIENT_ID = "${GOOG_CLIENT_ID}"`);
    modifiedData = modifiedData.replace(/const ENDPOINT = ""/, `const ENDPOINT = "${ENDPOINT}"`);
    fs.writeFile(outputFile, modifiedData, (err) => {
      if (err) throw err;
      console.log(`Successfully replaced CLIENT_ID with ${GOOG_CLIENT_ID}`);
    });
  });

}

main();
