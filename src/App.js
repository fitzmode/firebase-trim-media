import logo from "./logo.svg";
import "./App.css";
import UploadComponent from "./UploadComponent";
import firebase from "firebase";
import { useEffect } from "react";

let config = {
  apiKey: "AIzaSyDyOXMEdS5iQLUHH0LyJqOTqSHFeVP7sWk",
  authDomain: "video-processing-9da21.firebaseapp.com",
  projectId: "video-processing-9da21",
  storageBucket: "video-processing-9da21.appspot.com",
  messagingSenderId: "209016627905",
  appId: "1:209016627905:web:93cf5ad62998abfbf06a40",
  measurementId: "G-NG2FQHFLF8",
};

if (!firebase.apps.length) {
  firebase.initializeApp(config);

  // window.location.hostname === "localhost" &&
  //   firebase.firestore().useEmulator("localhost", 5002);
} else firebase.app();

function App() {
  useEffect(() => {
    firebase
      .firestore()
      .collection("/media")
      .get()
      .then((response) => {
        console.log(
          response.docs.map((doc) => ({ ...doc.data(), id: doc.id })),
          "YO"
        );
      });
  }, []);
  return (
    <div className="App">
      <UploadComponent />
    </div>
  );
}

export default App;
