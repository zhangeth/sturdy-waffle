import { JSONSchema7, JSONSchema7TypeName } from "json-schema";
import { UiSchema } from '@rjsf/utils';
import * as fs from "fs";
import * as path from "path";

const UISchemaFilePath = path.join(__dirname, "../../../" + process.env.UISCHEMA);
const JSchemaFilePath = path.join(__dirname, "../../../" + process.env.JSCHEMA);
const UISchemaFile = JSON.parse(fs.readFileSync(UISchemaFilePath, "utf8"));
const JSchemaFile = JSON.parse(fs.readFileSync(JSchemaFilePath, "utf8"));

import React from 'react';
import { createRoot } from 'react-dom/client';

// component functions
import Modal from "./components/modal";
import Table from "./components/Table";


const schema2: JSONSchema7 = JSchemaFile as JSONSchema7;
const UISchema = UISchemaFile as UiSchema;

let modalRoot;
let tableRoot;

declare global {
  interface Window {
    google?: any;
    onGoogleLibraryLoad?: () => void;
  }
}

function App() {
  if (tableRoot == null)
  {
    const container = document.getElementById("table-container");
    tableRoot = createRoot(container);
  }

  if (modalRoot == null)
  {
    const modalContainer = document.getElementById("modal-container");
    modalRoot= createRoot(modalContainer);
  }
  
  // renders table withe the form above it
  
  tableRoot.render(<Table schema={schema2} />);

  //modalRoot.render(<Modal/>);

  return (
    
    <div className="App">
      <header className="App-header">
      </header>
    </div>
    
  );
}

export default App;