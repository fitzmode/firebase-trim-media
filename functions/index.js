const functions = require("firebase-functions");
const admin = require("firebase-admin");
const ffmpeg_static = require("ffmpeg-static");
const { Storage } = require("@google-cloud/storage");
const path = require("path");
const storage = new Storage();
const os = require("os");
const fs = require("fs-extra");
const { ALLOWED_EXTENAMES } = require("./consts");
const { spawn } = require("child_process");
const tmpDir = os.tmpdir();
const serviceAccount = require("./service-account.json");
const { onRequest } = require("firebase-functions/lib/providers/https");

const config = JSON.parse(process.env.FIREBASE_CONFIG);
config.credential = admin.credential.cert(serviceAccount);
admin.initializeApp(config);

function pspawn(args) {
  return new Promise((resolve, reject) => {
    console.log(args, "Args")
    const process = spawn(ffmpeg_static, args);
    process.on("exit", function (code) {
      resolve("Complete");
    });
    process.on("error", function (err) {
      reject(err);
    });
  });
}

// exports.trimMedia = functions
//   .firestore
//   .document("media/{mediaId}")
//   .onUpdate(async (change, context) => {
//     try {
//       const { mediaId } = context.params;
//       const db = admin.firestore();
//       const { url, frames, frame_urls } = change.after.data();

//       //Safety check for allowed file types

//       if (!ALLOWED_EXTENAMES.includes(path.extname(url)))
//         throw new Error("File type not permitted");

//       // Temporary early return to prevent update loop when frame_urls are updated, depends on database structure.
//       if (frame_urls) return false;
//       if (!url) throw new Error("No url provided for media");
//       if (!frames || !Array.isArray(frames))
//         throw new Error("No frames values provided for media");

//       // Create folder in tmp based on unique mediaId
//       const workingdir = path.join(tmpDir, mediaId);
//       await fs.ensureDir(workingdir);

//       let command = `-i ${url} `;
//       const name = path.parse(url).name;
//       const ext = path.parse(url).ext;
//       for (let i = 0; i < frames.length; i++) {
//         const { from, to } = frames[i];

//         if (typeof from !== "number" || typeof to !== "number")
//           throw new Error("Provided values should be of type number");
//         // Make sure min comes first;
//         const min = Math.min(from, to);
//         const max = Math.max(from, to);
//         command += ` -ss ${min} -c copy -t ${
//           max - min
//         } ${workingdir}/${name}_${i}${ext}`;
//       }

//       if (!command) throw new Error("No trim segments for command");
//       // Split media with FFMPEG
//       await pspawn(`${command} -y`.split(" ").filter(Boolean));

//       // Upload
//       const uploadPromises = frames.map(async (frame, idx) => {
//         return await storage
//           .bucket(config.storageBucket)
//           .upload(`${workingdir}/${name}_${idx}${ext}`, {
//             //Maybe store by userId ==> media/{uid}/file to prevent name conflict between users
//             destination: path.join("media", `${name}_${idx}${ext}`),
//           });
//       });

//       const uploads = await Promise.all(uploadPromises);

//       const urlPromises = uploads.map(
//         async (upload) =>
//           await upload[0].getSignedUrl({
//             expires: "03-03-2041",
//             action: "read",
//           })
//       );
//       const urls = await Promise.all(urlPromises);

//       // urls is nested Arrays, flatten them
//       const merged = [].concat.apply([], urls);
//       // Update db

//       await db.collection("media").doc(mediaId).update({
//         frame_urls: merged,
//       });

//       // Delete tmpfiles
//       return await fs.remove(workingdir);
//     } catch (error) {
//       console.error(error);
//       return false;
//     }
//   });

// Will update doc and trigger file trimming.
exports.handleFileUpload = functions.storage
  .object()
  .onFinalize(async ({ bucket, name, metadata, mediaLink }, context) => {
    try {
      const directory = path.dirname(name);
      // Skip unrelated uploads
      if (directory !== "processing") return;

      const db = admin.firestore();
      if (!metadata.mediaId) throw new Error("Missing mediaId");

      await storage.bucket(bucket).file(name).makePublic();
      const url = `https://storage.googleapis.com/${bucket}/${name}`;

      // Probably best way to get public url but requires setting up IAM priviledges
      const [signed_url] = await storage
        .bucket(bucket)
        .file(name)
        .getSignedUrl({
          expires: "03-09-2491",
          action: "read",
        });

      db.collection("media").doc(metadata.mediaId).update({
        url,
        signed_url,
      });
    } catch (error) {
      console.log(error);
    }
  });




  exports.trimAndJoinMedia = functions
  .firestore
  .document("media/{mediaId}")
  .onUpdate(async (change, context) => {
    try {
      const { mediaId } = context.params;

      const db = admin.firestore();
      const { url, frames, frame_urls } = change.after.data();


      //Safety check for allowed file types

      if (!ALLOWED_EXTENAMES.includes(path.extname(url)))
        throw new Error("File type not permitted");

      // Temporary early return to prevent update loop when frame_urls are updated, depends on database structure.
      if (frame_urls) return false;
      if (!url) throw new Error("No url provided for media");
      if (!frames || !Array.isArray(frames))
        throw new Error("No frames values provided for media");

      // Create folder in tmp based on unique mediaId
      const workingdir = path.join(tmpDir, mediaId);
      await fs.ensureDir(workingdir);

      let split_command = `-i ${url} `;
      let concat_command = `-i concat:`;
      const {name, ext} = path.parse(url);

      for (let i = 0; i < frames.length; i++) {
        const { from, to } = frames[i];
        if (typeof from !== "number" || typeof to !== "number")
          throw new Error("Provided values should be of type number");
        // Make sure min comes first;
        const min = Math.min(from, to);
        const max = Math.max(from, to);
        split_command += ` -ss ${min} -c copy -t ${
          max - min
        } ${workingdir}/${name}_${i}${ext}`;
      // Remove pipe operator if last file. Not sure if it's at all consequential;
      concat_command += `${workingdir}/${name}_${i}${ext}${i === frames.length - 1 ? '' :'|'}`
      }


    
      // Split media with FFMPEG
      await pspawn(`${split_command} -y`.split(" ").filter(Boolean));

      // Concat media with FFMPEG
      await pspawn(`${concat_command} -y ${workingdir}/concat_${name}${ext}`.split(" ").filter(Boolean))

      // Upload
      const upload = await storage
          .bucket(config.storageBucket)
          .upload(`${workingdir}/concat_${name}${ext}`, {
            //Maybe store by userId ==> media/{uid}/file to prevent name conflict between users
            destination: path.join("media", `concat_${name}${ext}`),
          });

      const [merged_url] = await upload[0].getSignedUrl({
        expires: "03-03-2041",
        action: "read",
      })

      await db.collection("media").doc(mediaId).update({
        merged_url,
      });

      // Delete tmpfiles
      return await fs.remove(workingdir);
      
    } catch (error) {
      console.error(error);
      return false;
    }
  });

// Will update doc and trigger file trimming.
exports.handleFileUpload = functions.storage
  .object()
  .onFinalize(async ({ bucket, name, metadata, mediaLink }, context) => {
    try {
      const directory = path.dirname(name);
      // Skip unrelated uploads
      if (directory !== "processing") return;

      const db = admin.firestore();
      if (!metadata.mediaId) throw new Error("Missing mediaId");

      await storage.bucket(bucket).file(name).makePublic();
      const url = `https://storage.googleapis.com/${bucket}/${name}`;

      // Probably best way to get public url but requires setting up IAM priviledges
      const [signed_url] = await storage
        .bucket(bucket)
        .file(name)
        .getSignedUrl({
          expires: "03-09-2491",
          action: "read",
        });

      return db.collection("media").doc(metadata.mediaId).update({
        url,
        signed_url,
      });
    } catch (error) {
      console.log(error);
    }
  });

