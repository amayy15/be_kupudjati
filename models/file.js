import mongoose from "mongoose";

const Schema = mongoose.Schema;

const fileSchema = new Schema({
  nomorBarcode: { type: String }, // Menyimpan catalog_id dari MySQL
  catalog_title: { type: String },
  media_id: { type: Number },
  media_type: { type: String },
  fileName: { type: String },
  filePath: { type: String },
  fileSrc: { type: String },
  fileCover: { type: String }, // Path untuk file cover gambar
  uploadDate: { type: Date, default: Date.now },
});

const File = mongoose.model("File", fileSchema);

export default File;
