import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./config/db.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  const [rows] = await pool.query("SELECT 1 AS ok");
  res.json({ status: "ok", db: rows[0].ok === 1 });
});

app.get("/api/products", async (_req, res) => {
  const [rows] = await pool.query("SELECT product_id, name, description, created_at FROM products ORDER BY created_at DESC");
  res.json(rows);
});

app.get("/api/stores/:storeId/inventories", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT i.inventory_id, i.store_id, i.product_id, p.name AS product_name,
            i.total_stock, i.reservable_stock, i.reserved_stock
       FROM inventories i
       JOIN products p ON p.product_id = i.product_id
      WHERE i.store_id = ?`,
    [req.params.storeId]
  );
  res.json(rows);
});

app.post("/api/reservations", async (req, res) => {
  const { userId, inventoryId, quantity } = req.body;

  if (!userId || !inventoryId || !Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ message: "userId, inventoryId, positive quantity are required." });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [inventoryRows] = await connection.query(
      "SELECT inventory_id, store_id, product_id, reservable_stock FROM inventories WHERE inventory_id = ? FOR UPDATE",
      [inventoryId]
    );

    if (inventoryRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Inventory not found." });
    }

    const inventory = inventoryRows[0];

    if (inventory.reservable_stock < quantity) {
      await connection.rollback();
      return res.status(409).json({ message: "Not enough reservable stock." });
    }

    await connection.query(
      `UPDATE inventories
          SET reservable_stock = reservable_stock - ?,
              reserved_stock = reserved_stock + ?
        WHERE inventory_id = ?`,
      [quantity, quantity, inventoryId]
    );

    const [result] = await connection.query(
      `INSERT INTO reservations (user_id, inventory_id, store_id, product_id, quantity, status)
       VALUES (?, ?, ?, ?, ?, 'CONFIRMED')`,
      [userId, inventoryId, inventory.store_id, inventory.product_id, quantity]
    );

    await connection.commit();
    res.status(201).json({ reservationId: result.insertId, status: "CONFIRMED" });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: "Failed to create reservation." });
  } finally {
    connection.release();
  }
});

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
