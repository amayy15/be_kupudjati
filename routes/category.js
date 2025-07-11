import { Router } from "express";
import Category from "../models/category.js";
import { mysqlConnection as mysqlConn } from "../db.js";
import SubCategory from "../models/subcategory.js";
import { subCategoryValidation } from "../utils/validationSchema.js";
import verifyAccessToken from "../middlewares/verifyAccessToken.js";
import auth from "../middlewares/auth.js";

const router = Router();

router.get("/sub-categories", async (req, res) => {
  try {
    const subCtgy = await SubCategory.find();
    res.status(200).json({ error: false, subCtgy });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: true, message: "Internal server error" });
  }
});

router.get("/sub-categories/:id", async (req, res) => {
  try {
    const subCtgy = await SubCategory.find({ ctgy_id: req.params.id });
    res.status(200).json({ error: false, subCtgy });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: true, message: "Internal server error" });
  }
});

router.get("/sub-category/:id", async (req, res) => {
  try {
    const subCtgy = await SubCategory.findOne({ _id: req.params.id });

    const categories = subCtgy.subCtgy_ids;

    // const mysqlConn = mysqlConnection();

    const sql = "SELECT id, code, name FROM collectionmedias WHERE id IN (?)";

    mysqlConn.query(sql, [categories], (err, results) => {
      if (err) {
        console.error("Database query error: ", err);
        return res.status(500).json({ err: "Database query failed" });
      }

      res.status(200).json({ err: false, subCtgy, results });
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: true, message: "Internal server error" });
  }
});

router.post("/sub-category", async (req, res) => {
  try {
    const { error } = subCategoryValidation(req.body);
    if (error)
      return res
        .status(400)
        .json({ error: true, message: error.details[0].message });

    // console.log(req.body);

    if (
      req.body.subCtgyIds &&
      new Set(req.body.subCtgyIds).size !== req.body.subCtgyIds.length
    ) {
      return res.status(400).json({
        error: true,
        message: "subCtgyIds contains duplicate values",
      });
    }

    const subCtgy = await SubCategory.findOne({
      subCtgy_name: req.body.subCtgyName,
    });
    if (subCtgy)
      return res
        .status(409)
        .json({ error: true, message: "sub kategori sudah ada." });

    // const mysqlConn = mysqlConnection();
    const sql = "SELECT id FROM collectionmedias WHERE id IN (?)";

    mysqlConn.query(sql, [req.body.subCtgyIds], async (err, results) => {
      if (err) {
        console.error("Database query error: ", error);
        return res.status(500).json({ error: "Database query failed" });
      }

      const validIds = results.map((row) => row.id);

      // Filter out invalid subCtgyIds that weren't found in the query result
      const filteredSubCtgyIds = Array.isArray(req.body.subCtgyIds)
        ? req.body.subCtgyIds.filter((id) => validIds.includes(id))
        : [];

      // Create the new SubCategory only with valid IDs
      const newSubCtgy = await new SubCategory({
        ctgy_id: req.body.ctgyId,
        subCtgy_name: req.body.subCtgyName,
        subCtgy_ids: filteredSubCtgyIds,
        subCtgy_icon: req.body.subCtgyIcon,
        subCtgy_iconLib: req.body.subCtgyIconLib,
        subCtgy_type: filteredSubCtgyIds.length === 1 ? ['tunggal'] : ['plural'],
        subCtgy_path: req.body.subCtgyPath,
      }).save();

      res.status(201).json({
        error: false,
        message: `Sub Kategori "${newSubCtgy.subCtgy_name}" Berhasil Dibuat!`,
        newSubCtgy,
      });
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: true, message: "Internal server error" });
  }
});

router.put("/sub-category/:id", async (req, res) => {
  const { id } = req.params;
  const {
    addCategoryIds,
    removeCategoryIds,
    ctgyId,
    subCtgyName,
    subCtgyIcon,
    subCtgyIconLib,
    // subCtgyType,
    subCtgyPath,
  } = req.body;

  // console.log(subCtgyType);

  const hasDuplicates = (array) => new Set(array).size !== array.length;

  // Check for duplicates in addCategoryIds
  if (addCategoryIds && hasDuplicates(addCategoryIds)) {
    return res.status(400).json({
      error: true,
      message: `Duplicate IDs found in addCategoryIds: ${[
        ...new Set(addCategoryIds),
      ]}`,
    });
  }

  // Check for duplicates in removeCategoryIds
  if (removeCategoryIds && hasDuplicates(removeCategoryIds)) {
    return res.status(400).json({
      error: true,
      message: `Duplicate IDs found in removeCategoryIds: ${[
        ...new Set(removeCategoryIds),
      ]}`,
    });
  }

  // Check for common IDs in both addCategoryIds and removeCategoryIds
  const commonIds = (addCategoryIds || []).filter((id) =>
    (removeCategoryIds || []).includes(id)
  );
  if (commonIds.length > 0) {
    return res.status(400).json({
      error: true,
      message: `IDs ${commonIds.join(
        ", "
      )} are present in both add and remove categories. No such action allowed.`,
    });
  }

  try {
    const subCtgy = await SubCategory.findOne({ _id: id });
    if (!subCtgy) {
      return res.status(404).json({
        error: true,
        message: "Sub kategori tidak ditemukan",
      });
    }

    // Process the database query for validating IDs if addCategoryIds or removeCategoryIds exist
    let subCtgyIds = [
      ...new Set([...(subCtgy.subCtgy_ids || []), ...(addCategoryIds || [])]),
    ];
    if (removeCategoryIds) {
      subCtgyIds = subCtgyIds.filter((id) => !removeCategoryIds.includes(id));
    }

    // const mysqlConn = mysqlConnection();
    const sql = "SELECT id FROM collectionmedias WHERE id IN (?)";
    mysqlConn.query(sql, [subCtgyIds], async (err, results) => {
      if (err) {
        console.error("Database query error: ", err);
        return res
          .status(500)
          .json({ error: true, message: "Database query failed" });
      }

      const validIds = results.map((row) => row.id);
      const filteredSubCtgyIds = subCtgyIds.filter((id) =>
        validIds.includes(id)
      );

      // Update the sub-category fields
      subCtgy.ctgy_id = ctgyId || subCtgy.ctgy_id;
      subCtgy.subCtgy_name = subCtgyName || subCtgy.subCtgy_name;
      subCtgy.subCtgy_ids = filteredSubCtgyIds.length
        ? filteredSubCtgyIds
        : subCtgy.subCtgy_ids;
      subCtgy.subCtgy_icon = subCtgyIcon || subCtgy.subCtgy_icon;
      subCtgy.subCtgy_iconLib = subCtgyIconLib || subCtgy.subCtgy_iconLib;
      subCtgy.subCtgy_type = subCtgy.subCtgy_ids.length === 1 ? ['tunggal'] : ['plural']
      subCtgy.subCtgy_path = subCtgyPath || subCtgy.subCtgy_path;

      await subCtgy.save();

      res.status(200).json({
        error: false,
        message: `Sub Kategori \'${subCtgy.subCtgy_name}\' Berhasil Diedit`,
        subCtgy,
      });
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: true, message: "Internal server error" });
  }
});

router.get("/categories", (req, res) => {
  try {
    // const mysqlConn = mysqlConnection();

    const sql = "SELECT id, code, name FROM collectionmedias";

    mysqlConn.query(sql, (error, results) => {
      if (error) {
        console.error("Database query error: ", error);
        return res.status(500).json({ error: "Database query failed" });
      }

      res.status(200).json({ error: false, categories: results });
    });
  } catch (error) {
    console.error("Server error: ", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/category-groups", async (req, res) => {
  try {
    const groups = await Category.find();
    res.status(200).json({ error: false, groups });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: true, message: "Internal server error" });
  }
});

router.get("/category-group/:id", async (req, res) => {
  try {
    const group = await Category.findOne({ _id: req.params.id });

    const categories = group.categoryIds;

    // const mysqlConn = mysqlConnection();

    const sql = "SELECT id, code, name FROM collectionmedias WHERE id IN (?)";

    mysqlConn.query(sql, [categories], (err, results) => {
      if (err) {
        console.error("Database query error: ", error);
        return res.status(500).json({ err: "Database query failed" });
      }

      res.status(200).json({ err: false, results });
    });
  } catch (error) {
    console.log(error);
  }
});

router.post("/category-group", async (req, res) => {
  const { name, categoryIds } = req.body;

  //   console.log(categoryIds);

  try {
    // Validate that the selected categories exist in MySQL
    // const mysqlConn = mysqlConnection();
    const sql = "SELECT id FROM collectionmedias WHERE id IN (?)";
    mysqlConn.query(sql, [categoryIds], async (error, results) => {
      if (error) {
        console.error("MySQL query error: ", error);
        return res.status(500).json({ error: "Database query failed" });
      }

      if (results.length !== categoryIds.length) {
        return res.status(400).json({ error: "Some categories are invalid" });
      }

      // Create a new category in MongoDB
      const newCategory = new Category({
        name: name,
        categoryIds: categoryIds,
      });

      await newCategory.save();
      res
        .status(201)
        .json({ message: "Category created successfully", newCategory });
    });
  } catch (error) {
    console.error("Server error: ", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/category-group/:id", async (req, res) => {
  const { id } = req.params;
  const { addCategoryIds, removeCategoryIds } = req.body;

  try {
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    const hasDuplicates = (array) => {
      return new Set(array).size !== array.length;
    };

    if (addCategoryIds && hasDuplicates(addCategoryIds)) {
      return res.status(400).json({
        error: `Duplicate IDs found in addCategoryIds: ${[
          ...new Set(addCategoryIds),
        ]}`,
      });
    }

    if (removeCategoryIds && hasDuplicates(removeCategoryIds)) {
      return res.status(400).json({
        error: `Duplicate IDs found in removeCategoryIds: ${[
          ...new Set(removeCategoryIds),
        ]}`,
      });
    }

    const commonIds = addCategoryIds.filter((id) =>
      removeCategoryIds.includes(id)
    );
    if (commonIds.length > 0) {
      return res.status(400).json({
        error: `IDs ${commonIds.join(
          ", "
        )} are present in both add and remove categories. No such action allowed.`,
      });
    }

    if (addCategoryIds && addCategoryIds.length > 0) {
      category.categoryIds = [
        ...new Set([...category.categoryIds, ...addCategoryIds]),
      ];
    }

    if (removeCategoryIds && removeCategoryIds.length > 0) {
      category.categoryIds = category.categoryIds.filter(
        (id) => !removeCategoryIds.includes(id)
      );
    }

    await category.save();
    res
      .status(200)
      .json({ message: "Category updated successfully", category });
  } catch (error) {
    console.error("Server error: ", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
