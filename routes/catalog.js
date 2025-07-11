import mongoose from "mongoose";
import { mysqlConnection as mysqlConn } from "../db.js";
import { Router } from "express";
import {
  booksValidation,
  bookListValidation,
} from "../utils/validationSchema.js";
import File from "../models/file.js";
import multer from "multer";
import BookVisit from "../models/bookVisit.js";
import SubCategory from "../models/subcategory.js";

const router = Router();

router.get("/get-commons/", async (req, res) => {
  try {
    const distinctCtgyIds = await SubCategory.distinct("ctgy_id");
    const resultsByCategory = {};

    for (const ctgyId of distinctCtgyIds) {
      // Find sub-categories for the current `ctgy_id`
      const subCategories = await SubCategory.find({ ctgy_id: ctgyId });

      // Collect all unique `subCtgy_ids` for this `ctgy_id`
      const subCtgyIds = Array.from(
        new Set(subCategories.flatMap((doc) => doc.subCtgy_ids || []))
      );

      // Initialize MySQL connection
      // const mysqlConn = mysqlConnection();

      // Query MySQL for catalogs using the `subCtgyIds`
      const sql = `
        SELECT cl.nomorBarcode, c.title, c.author, c.coverURL, c.edition, c.publisher, 
               c.publishLocation, c.publishYear, c.subject, c.physicalDescription 
        FROM catalogs c 
        JOIN collections cl ON c.id = cl.catalog_id 
        JOIN collectionmedias cm ON cl.media_id = cm.id 
        WHERE cm.id IN (?)
      `;

      // Await the MySQL query response
      const catalogs = await new Promise((resolve, reject) => {
        mysqlConn.query(sql, [subCtgyIds], (err, results) => {
          if (err) {
            reject(err);
          } else {
            resolve(results);
          }
        });
      });

      // Close MySQL connection
      // mysqlConn.end();

      // Store the results in the resultsByCategory object
      resultsByCategory[ctgyId] = {
        totalDocuments: subCategories.length,
        totalSubCtgyIds: subCtgyIds.length,
        totalCatalogs: catalogs.length,
      };
    }

    res.status(200).json({
      error: false,
      resultsByCategory,
    });
  } catch (error) {
    console.error("Error getting data: ", error);
    res.status(500).json({ error: true, message: "Internal Server Error" });
  }
});

// router.get("/get-catalogs/:id", async (req, res) => {
//   try {
//     const mysqlConn = mysqlConnection();
//     const sql =
//       "SELECT cl.nomorBarcode, c.title, c.author, c.coverURL, c.edition, c.publisher, c.publishLocation, c.publishYear, c.subject, c.physicalDescription FROM catalogs c JOIN collections cl ON c.id = cl.catalog_id JOIN collectionmedias cm ON cl.media_id = cm.id WHERE cm.id = ?";

//     mysqlConn.query(sql, [req.params.id], async (err, results) => {
//       if (err) {
//         return res
//           .status(500)
//           .json({ error: true, message: "SQL Query Error" });
//       }

//       const catalogs = results;
//       // console.log(catalogs);

//       if (!catalogs || catalogs.length === 0) {
//         return res.status(404).json({
//           error: true,
//           message: "Catalogs with given id not found!",
//         });
//       }

//       res
//         .status(200)
//         .json({ error: false, totalData: results.length, catalogs: results });
//     });
//   } catch (error) {
//     console.log(error);
//     res.status(500).send({ error: true, message: "Internal server error" });
//   }
// });

router.get("/get-catalogs/:id", async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "" } = req.query;
    const offset = (page - 1) * limit;

    // Optimized approach: Use a single SQL query with LEFT JOIN to MongoDB-equivalent logic
    // First get all barcodes with files for this specific media_id to reduce MongoDB query size
    const existingBarcodes = await File.distinct("nomorBarcode");
    
    // Create a temporary table or use IN clause more efficiently
    let sql, queryParams;
    
    if (existingBarcodes.length > 0) {
      // Use EXISTS subquery which is more efficient than large IN clauses
      // Split large arrays to avoid MySQL query limits
      const batchSize = 1000; // MySQL IN clause limit consideration
      
      if (existingBarcodes.length <= batchSize) {
        sql = `
          SELECT cl.nomorBarcode, c.title, c.author, c.coverURL,
                 CASE WHEN cl.nomorBarcode IN (${existingBarcodes.map(() => '?').join(',')}) THEN 0 ELSE 1 END as priority
          FROM catalogs c
          JOIN collections cl ON c.id = cl.catalog_id
          JOIN collectionmedias cm ON cl.media_id = cm.id
          WHERE cm.id = ? 
          AND (c.title LIKE ? OR c.author LIKE ?)
          ORDER BY priority ASC, c.title ASC
          LIMIT ? OFFSET ?
        `;
        
        queryParams = [
          ...existingBarcodes,
          req.params.id,
          `%${search}%`,
          `%${search}%`,
          parseInt(limit),
          parseInt(offset),
        ];
      } else {
        // For very large datasets, use a different approach
        // First get catalogs with files, then catalogs without files
        const catalogsWithFiles = await new Promise((resolve, reject) => {
          const sqlWithFiles = `
            SELECT cl.nomorBarcode, c.title, c.author, c.coverURL, 0 as priority
            FROM catalogs c
            JOIN collections cl ON c.id = cl.catalog_id
            JOIN collectionmedias cm ON cl.media_id = cm.id
            WHERE cm.id = ? 
            AND (c.title LIKE ? OR c.author LIKE ?)
            AND cl.nomorBarcode IN (${existingBarcodes.slice(0, batchSize).map(() => '?').join(',')})
            ORDER BY c.title ASC
          `;
          
          mysqlConn.query(
            sqlWithFiles,
            [req.params.id, `%${search}%`, `%${search}%`, ...existingBarcodes.slice(0, batchSize)],
            (err, results) => {
              if (err) reject(err);
              else resolve(results || []);
            }
          );
        });

        // Calculate remaining limit after catalogs with files
        const remainingLimit = Math.max(0, parseInt(limit) - catalogsWithFiles.length);
        const adjustedOffset = Math.max(0, parseInt(offset) - catalogsWithFiles.length);

        let catalogsWithoutFiles = [];
        if (remainingLimit > 0) {
          catalogsWithoutFiles = await new Promise((resolve, reject) => {
            const sqlWithoutFiles = `
              SELECT cl.nomorBarcode, c.title, c.author, c.coverURL, 1 as priority
              FROM catalogs c
              JOIN collections cl ON c.id = cl.catalog_id
              JOIN collectionmedias cm ON cl.media_id = cm.id
              WHERE cm.id = ? 
              AND (c.title LIKE ? OR c.author LIKE ?)
              AND cl.nomorBarcode NOT IN (${existingBarcodes.slice(0, batchSize).map(() => '?').join(',')})
              ORDER BY c.title ASC
              LIMIT ? OFFSET ?
            `;
            
            mysqlConn.query(
              sqlWithoutFiles,
              [req.params.id, `%${search}%`, `%${search}%`, ...existingBarcodes.slice(0, batchSize), remainingLimit, adjustedOffset],
              (err, results) => {
                if (err) reject(err);
                else resolve(results || []);
              }
            );
          });
        }

        const allCatalogs = [...catalogsWithFiles, ...catalogsWithoutFiles];
        
        // Get fileCover for each catalog using batch query for better performance
        const barcodes = allCatalogs.map(catalog => catalog.nomorBarcode);
        const fileCovers = await File.find(
          { nomorBarcode: { $in: barcodes } },
          { nomorBarcode: 1, fileCover: 1 }
        );
        
        // Create a map for O(1) lookup
        const fileCoverMap = new Map();
        fileCovers.forEach(file => {
          fileCoverMap.set(file.nomorBarcode, file.fileCover);
        });

        const catalogsWithCover = allCatalogs.map(catalog => {
          const { priority, ...catalogData } = catalog;
          return {
            ...catalogData,
            fileCover: fileCoverMap.get(catalog.nomorBarcode) || null
          };
        });

        // Get total count
        const countSql = `
          SELECT COUNT(*) as total
          FROM catalogs c
          JOIN collections cl ON c.id = cl.catalog_id
          JOIN collectionmedias cm ON cl.media_id = cm.id
          WHERE cm.id = ? 
          AND (c.title LIKE ? OR c.author LIKE ?)
        `;

        const totalData = await new Promise((resolve, reject) => {
          mysqlConn.query(
            countSql,
            [req.params.id, `%${search}%`, `%${search}%`],
            (err, countResults) => {
              if (err) reject(err);
              else resolve(countResults[0].total);
            }
          );
        });

        return res.status(200).json({
          error: false,
          totalData: totalData,
          catalogs: catalogsWithCover,
        });
      }
    } else {
      // No files exist - use simple query
      sql = `
        SELECT cl.nomorBarcode, c.title, c.author, c.coverURL
        FROM catalogs c
        JOIN collections cl ON c.id = cl.catalog_id
        JOIN collectionmedias cm ON cl.media_id = cm.id
        WHERE cm.id = ? 
        AND (c.title LIKE ? OR c.author LIKE ?)
        ORDER BY c.title ASC
        LIMIT ? OFFSET ?
      `;

      queryParams = [
        req.params.id,
        `%${search}%`,
        `%${search}%`,
        parseInt(limit),
        parseInt(offset),
      ];
    }

    // Execute the standard query for smaller datasets
    mysqlConn.query(
      sql,
      queryParams,
      async (err, results) => {
        if (err) {
          return res
            .status(500)
            .json({ error: true, message: "SQL Query Error" });
        }

        const catalogs = results;

        if (!catalogs || catalogs.length === 0) {
          return res.status(404).json({
            error: true,
            message: "Catalogs with given id not found!",
          });
        }

        // Batch query for file covers - more efficient than individual queries
        const barcodes = catalogs.map(catalog => catalog.nomorBarcode);
        const fileCovers = await File.find(
          { nomorBarcode: { $in: barcodes } },
          { nomorBarcode: 1, fileCover: 1 }
        );
        
        // Create a map for O(1) lookup instead of nested loops
        const fileCoverMap = new Map();
        fileCovers.forEach(file => {
          fileCoverMap.set(file.nomorBarcode, file.fileCover);
        });

        const catalogsWithCover = catalogs.map(catalog => {
          const { priority, ...catalogData } = catalog;
          return {
            ...catalogData,
            fileCover: fileCoverMap.get(catalog.nomorBarcode) || null
          };
        });

        // Get total count for pagination
        const countSql = `
          SELECT COUNT(*) as total
          FROM catalogs c
          JOIN collections cl ON c.id = cl.catalog_id
          JOIN collectionmedias cm ON cl.media_id = cm.id
          WHERE cm.id = ? 
          AND (c.title LIKE ? OR c.author LIKE ?)
        `;

        mysqlConn.query(
          countSql,
          [req.params.id, `%${search}%`, `%${search}%`],
          (err, countResults) => {
            if (err) {
              return res
                .status(500)
                .json({ error: true, message: "SQL Query Error" });
            }

            const totalData = countResults[0].total;

            res.status(200).json({
              error: false,
              totalData: totalData,
              catalogs: catalogsWithCover,
            });
          }
        );
      }
    );
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: true, message: "Internal server error" });
  }
});

router.get("/get-catalog/:nomorBarcode", async (req, res) => {
  try {
    const sql =
      "SELECT  cl.noInduk, cl.nomorBarcode, c.title, c.author, c.edition, c.publisher, c.publishLocation, c.publishYear, c.publikasi, c.subject, c.physicalDescription, c.callNumber, cm.id, cm.name FROM catalogs c JOIN collections cl ON c.id = cl.catalog_id JOIN collectionmedias cm ON cl.media_id = cm.id WHERE cl.nomorBarcode = ?";

    console.log("triggered", req.params.nomorBarcode);

    mysqlConn.query(sql, [req.params.nomorBarcode], async (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ error: true, message: "SQL Query Error" });
      }

      // If no book is found in MySQL
      if (!results || results.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Book with given barcode not found in MySQL!",
        });
      }

      // Check if nomorBarcode exists in MongoDB File collection
      const fileExists = await File.exists({ nomorBarcode: req.params.nomorBarcode });

      // Send the combined MySQL and MongoDB data with boolean status
      res.status(200).json({
        error: false,
        catalog: results, // MySQL result
        fileExists: !!fileExists, // true if exists, false otherwise
      });
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: true, message: "Internal server error" });
  }
});

router.get("/get-catalog-file/:nomorBarcode", async (req, res) => {
  try {

    const sql = `
      SELECT cl.nomorBarcode, c.title, c.author, c.coverURL, c.edition, c.publisher, c.publishLocation, c.publishYear, c.subject, c.physicalDescription
      FROM catalogs c
      JOIN collections cl ON c.id = cl.catalog_id
      JOIN collectionmedias cm ON cl.media_id = cm.id
      WHERE cl.nomorBarcode = ? 
    `;

    const catalogData = await new Promise((resolve, reject) => {
      mysqlConn.query(sql, [req.params.nomorBarcode], (err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results);
        }
      });
    });    // Check MongoDB for catalogFile
    const catalogFile = await File.findOne({
      nomorBarcode: req.params.nomorBarcode,
    });

    // If catalogFile is found, return success with the file data
    if (catalogData) {
      return res.status(200).json({
        success: true,
        message: "Catalog file found.",
        catalogFile: catalogFile,
        catalogData: catalogData[0] || null,
        fileCover: catalogFile?.fileCover || null
      });
    } else {
      // If catalogFile is not found, return fail response
      return res.status(404).json({
        success: false,
        message: "Catalog file not found.",
      });
    }
  } catch (error) {
    // Handle internal server error
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// Multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Determine folder based on file type (MIME type) and field name
    let folder = "";

    if (file.fieldname === "cover") {
      folder = "uploads/covers/"; // Cover images go here
    } else if (file.mimetype.startsWith("audio/")) {
      folder = "uploads/aud/"; // Audio files go here
    } else if (file.mimetype.startsWith("video/")) {
      folder = "uploads/vid/"; // Video files go here
    } else if (file.mimetype.startsWith("image/")) {
      folder = "uploads/img/"; // Image files go here
    } else if (file.mimetype === "application/pdf") {
      folder = "uploads/doc/"; // PDF files go here
    } else {
      // Reject unsupported file types
      return cb(new Error("Unsupported file type"), false);
    }

    // Callback to set the folder destination
    cb(null, folder);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname); // File name with timestamp
  },
});

const upload = multer({ storage });

// POST route for file upload
router.post("/upload", upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'cover', maxCount: 1 }
]), async (req, res) => {
  const { nomorBarcode, fileSrc } = req.body;

  try {
    const sql =
      "SELECT cl.nomorBarcode, c.title, cm.id AS media_id, cm.name AS media_name FROM catalogs c JOIN collections cl ON c.id = cl.catalog_id JOIN collectionmedias cm ON cl.media_id = cm.id WHERE cl.nomorBarcode = ?";

    mysqlConn.query(sql, [nomorBarcode], async (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ error: true, message: "SQL Query Error" });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: "Catalog not found" });
      }

      const barcode = results[0].nomorBarcode;
      const catalog_title = results[0].title;
      const media_id = results[0].media_id;
      const media_name = results[0].media_name;

      // Check if file with nomorBarcode exists
      let fileDoc = await File.findOne({ nomorBarcode: barcode });

      const mainFile = req.files?.file?.[0];
      const coverFile = req.files?.cover?.[0];      if (fileDoc) {
        // Update existing document - only update fields that are provided
        if (catalog_title) fileDoc.catalog_title = catalog_title;
        if (media_id) fileDoc.media_id = media_id;
        if (media_name) fileDoc.media_type = media_name;
        if (fileSrc !== undefined) fileDoc.fileSrc = fileSrc;
        
        // Update main file only if provided
        if (mainFile) {
          fileDoc.fileName = mainFile.filename;
          fileDoc.filePath = mainFile.path;
        }
        
        // Update cover file only if provided
        if (coverFile) {
          fileDoc.fileCover = coverFile.path;
        }
        
        await fileDoc.save();

        res.status(200).json({
          message: "File updated in MongoDB successfully",
          file: fileDoc,
        });
      } else {
        // Create new document - require main file for new records
        if (!mainFile) {
          return res.status(400).json({
            error: true,
            message: "Main file is required for new records"
          });
        }

        const newFile = new File({
          nomorBarcode: barcode,
          catalog_title: catalog_title,
          media_id: media_id,
          media_type: media_name,
          fileName: mainFile.filename,
          filePath: mainFile.path,
          fileCover: coverFile?.path || null,
          fileSrc: fileSrc || null,
        });

        await newFile.save();

        res.status(200).json({
          message: "File uploaded and saved to MongoDB successfully",
          file: newFile,
        });
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to upload file", error });
  }
});

// API for BookList
router.post("/booklists", async (req, res) => {
  try {
    const { error } = bookListValidation(req.body);
    if (error)
      return res
        .status(400)
        .json({ error: true, message: error.details[0].message });

    const location = await Location.findById(req.body.location_id);
    if (!location)
      return res.status(404).json({
        error: true,
        message: "Location with given ID not found!",
      });

    const bookList = await BookList.findOne({
      location_id: req.body.location_id,
    });
    if (bookList)
      return res.status(409).json({
        error: true,
        message: "Book list for given location already exists!",
      });

    await new BookList({ ...req.body }).save();

    res
      .status(201)
      .json({ error: false, message: "Book list added successfully!" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: true, message: "Internal server error" });
  }
});

router.get("/booklists", async (req, res) => {
  try {
    const bookLists = await BookList.find();
    res.status(200).json({ error: false, bookLists });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: true, message: "Internal server error" });
  }
});

router.get("/details", async (req, res) => {
  const { location_id } = req.query;

  if (!mongoose.Types.ObjectId.isValid(location_id)) {
    return res
      .status(400)
      .json({ error: true, message: "Invalid location ID format" });
  }

  try {
    const locationObjectId = new mongoose.Types.ObjectId(location_id);

    const location = await Location.findById(locationObjectId);
    if (!location) {
      return res
        .status(404)
        .json({ error: true, message: "Location not found" });
    }

    const bookList = await BookList.findOne({ location_id: locationObjectId });
    if (!bookList) {
      return res
        .status(404)
        .json({ error: true, message: "No books found for this location" });
    }

    const books = await Book.find({ isbn: { $in: bookList.book_id } });

    res.status(200).json({ error: false, location, books });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: true, message: "Internal server error" });
  }
});

// MySQL Route
router.get("/data", (req, res) => {
  try {
    // const mysqlConn = mysqlConnection();

    const sql =
      "SELECT c.id, c.title, c.author, c.edition, c.publisher, c.publishLocation, c.publishYear, c.publikasi, c.subject, c.physicalDescription FROM catalogs c JOIN collections cl ON c.id = cl.catalog_id JOIN collectionmedias cm ON cl.media_id = cm.id WHERE cm.id = 1 LIMIT 20";

    mysqlConn.query(sql, (error, results) => {
      if (error) {
        console.error("Database query error: ", error);
        return res.status(500).json({ error: "Database query failed" });
      }

      res.status(200).json(results);
    });
  } catch (error) {
    console.error("Server error: ", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post('/track/:barcode', async (req, res) => {
  const { barcode } = req.params;
  try {
    const existing = await BookVisit.findOne({ barcode });

    if (existing) {
      existing.visitCount += 1;
      existing.lastVisitedAt = new Date();
      await existing.save();
    } else {
      await BookVisit.create({
        barcode,
        visitCount: 1,
        lastVisitedAt: new Date(),
      });
    }

    res.status(200).json({ message: 'Visit recorded' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/top-books', async (req, res) => {
  try {
    const topBooks = await BookVisit.find({})
      .sort({ visitCount: -1 })
      .limit(10); // ambil 10 teratas

    // Query book details for each barcode
    const booksWithDetails = await Promise.all(
      topBooks.map(async (book) => {
        const sql = `
          SELECT cl.nomorBarcode, c.title, c.author, c.coverURL, c.edition, c.publisher, c.publishLocation, c.publishYear, c.subject, c.physicalDescription
          FROM catalogs c
          JOIN collections cl ON c.id = cl.catalog_id
          JOIN collectionmedias cm ON cl.media_id = cm.id
          WHERE cl.nomorBarcode = ?
        `;

        const catalogData = await new Promise((resolve, reject) => {
          mysqlConn.query(sql, [book.barcode], (err, results) => {
            if (err) {
              reject(err);
            } else {
              resolve(results[0] || null);
            }
          });
        });

        const catalogFile = await File.findOne({
          nomorBarcode: book.barcode,
        });

        console.log("Catalog Data:", catalogData);

        console.log("Catalog File:", catalogFile);

        return {
          barcode: book.barcode,
          visitCount: book.visitCount,
          lastVisitedAt: book.lastVisitedAt,
          ...catalogData,
          catalogFile: catalogFile ? catalogFile.fileCover : null,
        };
      })
    );

    // Filter out books that don't have catalog data
    const validBooks = booksWithDetails.filter(book => book.title);

    res.json(validBooks);
  } catch (err) {
    console.error('Error fetching top books:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Search route for frontend
router.get("/search", async (req, res) => {
  try {
    const { query = "", page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Search SQL query that filters by barcode, title, and author
    const sql = `
      SELECT cl.nomorBarcode, c.title, c.author, c.coverURL, c.edition, c.publisher, 
             c.publishLocation, c.publishYear, c.subject, c.physicalDescription
      FROM catalogs c
      JOIN collections cl ON c.id = cl.catalog_id
      JOIN collectionmedias cm ON cl.media_id = cm.id
      WHERE (cl.nomorBarcode LIKE ? OR c.title LIKE ? OR c.author LIKE ?)
      LIMIT ? OFFSET ?
    `;

    mysqlConn.query(
      sql,
      [
        `%${query}%`,
        `%${query}%`, 
        `%${query}%`,
        parseInt(limit),
        parseInt(offset),
      ],      
      
      async (err, results) => {
        if (err) {
          console.error("SQL Query Error:", err);
          return res
            .status(500)
            .json({ error: true, message: "SQL Query Error" });
        }

        // Get fileCover for each catalog by barcode using batch query
        const barcodes = results.map(catalog => catalog.nomorBarcode);
        const fileCovers = await File.find(
          { nomorBarcode: { $in: barcodes } },
          { nomorBarcode: 1, fileCover: 1 }
        );

        // Create a map for O(1) lookup
        const fileCoverMap = new Map();
        fileCovers.forEach(file => {
          fileCoverMap.set(file.nomorBarcode, file.fileCover);
        });

        // Add fileCover to each catalog
        const catalogsWithCover = results.map(catalog => ({
          ...catalog,
          fileCover: fileCoverMap.get(catalog.nomorBarcode) || null
        }));

        // Get total count for pagination
        const countSql = `
          SELECT COUNT(*) as total
          FROM catalogs c
          JOIN collections cl ON c.id = cl.catalog_id
          JOIN collectionmedias cm ON cl.media_id = cm.id
          WHERE (cl.nomorBarcode LIKE ? OR c.title LIKE ? OR c.author LIKE ?)
        `;

        mysqlConn.query(
          countSql,
          [`%${query}%`, `%${query}%`, `%${query}%`],
          (err, countResults) => {
            if (err) {
              console.error("Count Query Error:", err);
              return res
                .status(500)
                .json({ error: true, message: "Count Query Error" });
            }

            const totalData = countResults[0].total;
            const totalPages = Math.ceil(totalData / limit);

            res.status(200).json({
              error: false,
              query: query,
              currentPage: parseInt(page),
              totalPages: totalPages,
              totalData: totalData,
              limit: parseInt(limit),
              catalogs: catalogsWithCover,
            });
          }
        );
      }
    );
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: true, message: "Internal server error" });
  }
});

export default router;
