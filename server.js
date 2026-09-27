const express = require("express");
const session = require("express-session");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const db = new Database("vegeta.db");
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Vegeta@123";
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || "918617891012";

db.exec(`
CREATE TABLE IF NOT EXISTS products (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 emoji TEXT NOT NULL,
 price REAL NOT NULL,
 stock INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 order_code TEXT UNIQUE NOT NULL,
 customer TEXT NOT NULL,
 phone TEXT NOT NULL,
 address TEXT NOT NULL,
 items TEXT NOT NULL,
 total REAL NOT NULL,
 status TEXT NOT NULL DEFAULT 'New',
 created_at TEXT NOT NULL,
 location_lat REAL,
 location_lng REAL
);`);
try { db.exec("ALTER TABLE orders ADD COLUMN location_lat REAL"); } catch(e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN location_lng REAL"); } catch(e) {}

const count = db.prepare("SELECT COUNT(*) c FROM products").get().c;
if (!count) {
 const p = db.prepare("INSERT INTO products(name,emoji,price,stock) VALUES(?,?,?,?)");
 [
  ["Potato","🥔",30,1],["Tomato","🍅",40,1],["Onion","🧅",45,1],
  ["Carrot","🥕",50,1],["Cabbage","🥬",35,1],["Cauliflower","🥦",55,1],
  ["Brinjal","🍆",45,1],["Green Chilli","🌶️",60,1],["Lady Finger","🫛",50,1],["Pumpkin","🎃",35,1]
 ].forEach(x=>p.run(...x));
}

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(session({
 secret: process.env.SESSION_SECRET || "change-this-secret",
 resave:false, saveUninitialized:false,
 cookie:{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production"}
}));
app.use(express.static(path.join(__dirname,"public")));

function admin(req,res,next){
 if(req.session.admin) return next();
 res.status(401).json({error:"Admin login required"});
}

app.get("/api/products",(req,res)=>{
 res.json(db.prepare("SELECT * FROM products ORDER BY id").all());
});

app.post("/api/orders",(req,res)=>{
 const {customer,phone,address,items,location} = req.body;
 if(!customer || !phone || !address || !Array.isArray(items) || !items.length)
   return res.status(400).json({error:"Missing order details"});

 let total=0, finalItems=[];
 for(const item of items){
   const p=db.prepare("SELECT * FROM products WHERE id=?").get(item.productId);
   const qty=Number(item.qty);
   if(!p || p.stock!==1 || !Number.isFinite(qty) || qty<=0)
     return res.status(400).json({error:"Invalid or unavailable product"});
   const line=Number((p.price*qty).toFixed(2));
   total+=line;
   finalItems.push({productId:p.id,name:p.name,emoji:p.emoji,price:p.price,qty,line});
 }
 total=Number(total.toFixed(2));
 const lat = location && Number.isFinite(Number(location.lat)) ? Number(location.lat) : null;
 const lng = location && Number.isFinite(Number(location.lng)) ? Number(location.lng) : null;
 const code="VG-"+Date.now().toString().slice(-8);
 db.prepare(`INSERT INTO orders(order_code,customer,phone,address,items,total,created_at,location_lat,location_lng)
             VALUES(?,?,?,?,?,?,?,?,?)`)
   .run(code,customer,phone,address,JSON.stringify(finalItems),total,new Date().toISOString(),lat,lng);

 const message=[
  "🥬 *VEGETA - NEW ORDER*","━━━━━━━━━━━━━━━━━━",
  "🆔 *Order ID:* "+code,"👤 *Customer:* "+customer,
  "📞 *Phone:* "+phone,"📍 *Address:* "+address,
  ...(lat!==null && lng!==null ? ["🗺️ *Map:* https://www.google.com/maps?q="+lat.toFixed(6)+","+lng.toFixed(6)] : []),
  "━━━━━━━━━━━━━━━━━━","🛒 *ITEMS*",
  ...finalItems.map((x,i)=>`${i+1}. ${x.name} - ${x.qty<1?Math.round(x.qty*1000)+" g":x.qty+" kg"} × ₹${x.price} = ₹${x.line.toFixed(2)}`),
  "━━━━━━━━━━━━━━━━━━","💰 *TOTAL: ₹"+total.toFixed(2)+"*",
  "━━━━━━━━━━━━━━━━━━","Please confirm this order."
 ].join("\n");
 res.json({ok:true,orderCode:code,total,whatsappUrl:`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`});
});

app.post("/api/admin/login",(req,res)=>{
 if(req.body.password===ADMIN_PASSWORD){req.session.admin=true;return res.json({ok:true})}
 res.status(401).json({error:"Wrong password"});
});
app.post("/api/admin/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get("/api/admin/me",admin,(req,res)=>res.json({ok:true}));

app.get("/api/admin/orders",admin,(req,res)=>{
 const rows=db.prepare("SELECT * FROM orders ORDER BY id DESC").all();
 res.json(rows.map(x=>({...x,items:JSON.parse(x.items)})));
});
app.patch("/api/admin/orders/:id",admin,(req,res)=>{
 const allowed=["New","Confirmed","Preparing","Out for delivery","Delivered","Cancelled"];
 if(!allowed.includes(req.body.status)) return res.status(400).json({error:"Invalid status"});
 db.prepare("UPDATE orders SET status=? WHERE id=?").run(req.body.status,req.params.id);
 res.json({ok:true});
});

app.post("/api/admin/products",admin,(req,res)=>{
 const {name,emoji="🥬",price,stock=true}=req.body;
 if(!name || !Number.isFinite(Number(price)) || Number(price)<0) return res.status(400).json({error:"Invalid product"});
 const r=db.prepare("INSERT INTO products(name,emoji,price,stock) VALUES(?,?,?,?)")
   .run(name,emoji,Number(price),stock?1:0);
 res.json({id:r.lastInsertRowid});
});
app.patch("/api/admin/products/:id",admin,(req,res)=>{
 const {name,emoji,price,stock}=req.body;
 db.prepare("UPDATE products SET name=?,emoji=?,price=?,stock=? WHERE id=?")
   .run(name,emoji,Number(price),stock?1:0,req.params.id);
 res.json({ok:true});
});
app.delete("/api/admin/products/:id",admin,(req,res)=>{
 db.prepare("DELETE FROM products WHERE id=?").run(req.params.id);
 res.json({ok:true});
});

app.get("/admin",(req,res)=>res.sendFile(path.join(__dirname,"public","admin.html")));
app.listen(PORT,()=>console.log(`Vegeta running on port ${PORT}`));
