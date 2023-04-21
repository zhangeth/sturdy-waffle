import React from 'react';
import { JSONSchema7, JSONSchema7TypeName } from "json-schema";
import * as fs from "fs";
import * as path from "path";

import { useEffect, useState } from "react";

import validator from '@rjsf/validator-ajv8';
import Form, { IChangeEvent } from "@rjsf/core";
import { UiSchema } from '@rjsf/utils';

const UISchemaFilePath = path.join(__dirname, "../../../" + process.env.UISCHEMA);
const JSchemaFilePath = path.join(__dirname, "../../../" + process.env.JSCHEMA);
const UISchemaFile = JSON.parse(fs.readFileSync(UISchemaFilePath, "utf8"));
const JSchemaFile = JSON.parse(fs.readFileSync(JSchemaFilePath, "utf8"));

import './Table.css';

type TableProps = {
  schema: JSONSchema7;
};

type FieldValues = {
  [fieldName: string]: Array<string | undefined>;
};

const schema: JSONSchema7 = JSchemaFile as JSONSchema7;

const UISchema = UISchemaFile as UiSchema;

function Table({ schema }: TableProps) {
  // Extract the field names from the schema
  const fieldNames = schema ? Object.keys(schema.properties || {}) : [];

  // Initialize the table data as an empty array of objects
  const [tableData, setTableData] = useState<Array<FieldValues>>([]);

  // Add a row to the table when the form is submitted
  const handleFormSubmit = (data: any) => {
    // Extract the field values from the submitted form data
    //console.log(data["formData"]["experiment_description"]);

    const fieldValues: FieldValues = {};

    for (const fieldName of fieldNames) {
      fieldValues[fieldName] = data["formData"][fieldName];
    //   if (typeof(data["formData"][fieldName]) == "object")
    //   {
    //     console.log(fieldName + " is of type arrays");
    //   }
    }
    
    // Add the new row to the table data
    setTableData([...tableData, fieldValues]);
    
    // later want to change this to fetch from backend 
  };

  return (
    <div>
        <Form schema={schema} validator={validator} uiSchema={UISchema} onSubmit={handleFormSubmit}/>
      
      <table className="table">
        <thead>
          <tr>
            {fieldNames.map((fieldName) => (
              <th key={fieldName}>{fieldName}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableData.map((rowData, index) => (
            <tr key={index}>
              {fieldNames.map((fieldName) => (
                
                <td key={fieldName}>
                  {
                    rowData[fieldName] ? rowData[fieldName][0]: ""
                  }
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Table;