import React from "react";
import firebase from "firebase";
import { nanoid } from "nanoid";
import JSONPretty from "react-pretty-json";

function UploadComponent() {
  const handleChange = async (e) => {
    try {
      const db = firebase.firestore();

      const { id: mediaId } = await db.collection("media").add({
        frames,
      });

      // Process File
      const file = e.target.files[0];
      if(!file) return console.log('No file selected')
      const ref = firebase.storage().ref("/processing");
      const fileRef = ref.child(file.name);
      const upload = await fileRef.put(file, {
        customMetadata: {
          // Associate file with existing document
          mediaId,
        },
      });

      const url = await upload.ref.getDownloadURL();
      console.log(url);
    } catch (error) {
      console.log(error);
    }
  };

  const [frames, addFrame] = React.useState([
    { from: 0, to: 0, key: nanoid() },
  ]);

  function getMin(idx) {
    return idx > 0 ? frames[idx - 1].to : 0;
  }

  const values = JSON.stringify({ frames });

  return (
    <div>
      {frames.map((frame, idx) => (
        <div key={frame.key}>
          <label>
            From:
            <input
              onChange={(e) => {
                addFrame((state) =>
                  state.map((f) =>
                    f.key === frame.key
                      ? { ...f, from: Number(e.target.value) }
                      : f
                  )
                );
              }}
              min={getMin(idx)}
              max={frame.to - 1}
              type="number"
              defaultValue={getMin(idx)}
            />
          </label>
          <label>
            To:
            <input
              min={getMin(idx) + 1}
              onChange={(e) => {
                addFrame((state) =>
                  state.map((f) =>
                    f.key === frame.key
                      ? { ...f, to: Number(e.target.value) }
                      : f
                  )
                );
              }}
              type="number"
              defaultValue={getMin(idx)}
            />
          </label>
        </div>
      ))}
      <button
        onClick={() => {
          addFrame((state) => [...state, { from: 0, to: 0, key: nanoid() }]);
        }}
      >
        Add Frame
      </button>
      <input
        placeholder="Upload File"
        accept=".mp3,.wav,.mov,.mp4,.webm,.avi,.aac"
        onChange={handleChange}
        type="file"
      />
      <div
        style={{ width: 300, padding: 12, height: 300, background: "#f5f5f5" }}
      >
        {JSON.stringify(frames, null, "\t")}

        {/* <JSONPretty id="json-pretty" data={values}></JSONPretty> */}
      </div>
    </div>
  );
}

export default UploadComponent;
