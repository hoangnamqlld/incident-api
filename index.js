require('dotenv').config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const { initializeApp, cert } = require("firebase-admin/app");
const { getStorage } = require("firebase-admin/storage");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

// Khởi tạo Firebase Admin (sẽ dùng serviceAccountKey.json)
// Lưu file serviceAccountKey.json ở cùng folder sau khi bạn tải từ Firebase Console
initializeApp({
  credential: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  storageBucket: process.env.FIREBASE_BUCKET,
});

const bucket = getStorage().bucket();
const db = getFirestore();
const app = express();
const upload = multer({ dest: "uploads/" });
app.use(express.json());

app.post("/upload-report", upload.array("incidentImages"), async (req, res) => {
  try {
    const urls = [];
    for (const file of req.files) {
      const dest = `incidentImages/${Date.now()}_${file.originalname}`;
      await bucket.upload(file.path, { destination: dest, metadata: { contentType: file.mimetype } });
      fs.unlinkSync(file.path);
      const fileRef = bucket.file(dest);
      const [downloadURL] = await fileRef.getSignedUrl({ action: "read", expires: "03-01-2030" });
      urls.push(downloadURL);
    }

    const payload = {
      MaBaoCaoSuCo: req.body.MaBaoCaoSuCo || `SC-${Date.now()}`,
      NgayPhatHien: FieldValue.serverTimestamp(),
      NguoiBaoCao: req.body.NguoiBaoCao || "N/A",
      LoaiSuCo: req.body.LoaiSuCo || "Không rõ",
      MucDoNghiemTrong: req.body.MucDoNghiemTrong || "Không xác định",
      MoTaSuCo: req.body.MoTaSuCo || "",
      ViTriSuCo: req.body.ViTriSuCo || "",
      GPS: {
        longitude: parseFloat(req.body.GPS?.longitude || null),
        latitude: parseFloat(req.body.GPS?.latitude || null)
      },
      TrangThaiXuLy: req.body.TrangThaiXuLy || "Mới",
      DonViDeNghiXuLy: req.body.DonViDeNghiXuLy || null,
      NguoiXuLyDeXuat: req.body.NguoiXuLyDeXuat || null,
      HinhAnhURL: urls
    };

    await db.collection("incidentReports").add(payload);
    res.json({ success: true, report: payload, imageUrls: urls });
  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
