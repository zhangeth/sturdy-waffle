import React, { useEffect } from "react";
import { Modal, Button } from 'react-bootstrap';
import * as fs from "fs";
import * as path from "path";

import { useState } from 'react';
import ReactDOM from 'react-dom';


import validator from '@rjsf/validator-ajv8';
import Form, { IChangeEvent } from "@rjsf/core";
import { JSONSchema7, JSONSchema7TypeName } from "json-schema";
import { UiSchema } from '@rjsf/utils';

const UISchemaFilePath = path.join(__dirname, "../../../" + process.env.UISCHEMA);
const JSchemaFilePath = path.join(__dirname, "../../../" + process.env.JSCHEMA);
const UISchemaFile = JSON.parse(fs.readFileSync(UISchemaFilePath, "utf8"));
const JSchemaFile = JSON.parse(fs.readFileSync(JSchemaFilePath, "utf8"));

declare global {
    interface Window {
      google?: any;
    }
}
  

export function modal()
{
    const [showModal, setShowModal] = useState(false);

    const [tableData, setTableData] = useState([]);

    const handleClose = () => {
        setShowModal(false);
    }

    const handleShow = () => {
        setShowModal(true);
    }

    const schema: JSONSchema7 = JSchemaFile as JSONSchema7;

    const UISchema = UISchemaFile as UiSchema;

    type FieldValues = {
        [fieldName: string]: Array<string | undefined>;
    };
    
    const [fieldValues, setFieldValues] = useState<any[]>([]);

  // Extract the field names from the schema
    const fieldNames = schema ? Object.keys(schema.properties || {}) : [];

    return (
    <>
      <Button onClick={handleShow}>Show Modal</Button>

      <Modal show={showModal} onHide={handleClose}>
        <Modal.Header>
          <Modal.Title>Basic Example</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <div>
            <Form schema={schema} validator={validator} uiSchema={UISchema}/>
          </div>
        </Modal.Body>
        
        <Modal.Footer>
          <Button onClick={handleClose}>Close</Button> 
        </Modal.Footer>

      </Modal>
    </>
    );
}

export default modal;