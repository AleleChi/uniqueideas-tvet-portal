import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const OFFICIAL_SECTORS = [
  { id: "s1", sector_code: "AGR", sector_name: "AGRICULTURE", description: "Agricultural and farming skill development" },
  { id: "s2", sector_code: "CON", sector_name: "BUILDING CONSTRUCTION", description: "Civil work, masonry and modern construction infrastructure" },
  { id: "s3", sector_code: "ICT", sector_name: "DIGITAL SKILLS", description: "Information and communications technology, digital systems" },
  { id: "s4", sector_code: "ENG", sector_name: "ENGINEERING SERVICES", description: "Furniture, upholstery, woodwork, and metal fabrication services" },
  { id: "s5", sector_code: "CRE", sector_name: "HOSPITALITY, LEISURE, TOURISM & CREATIVE SERVICES", description: "Catering, culinary, fashion design and leather works" },
  { id: "s6", sector_code: "AUT", sector_name: "AUTOMOBILE SKILLS", description: "Automobile diagnostics, repairs and mechanics" },
  { id: "s7", sector_code: "REN", sector_name: "RENEWABLE ENERGY", description: "Solar installation, wind systems and clean technologies" },
  { id: "s8", sector_code: "COS", sector_name: "BEAUTY COSMETOLOGY", description: "Cosmetology, beauty, makeup and wig making" },
  { id: "s9", sector_code: "CHD", sector_name: "CHILDCARE", description: "Early child education and baby care support" },
  { id: "s10", sector_code: "EDU", sector_name: "EDUCATION", description: "Technical teachers training and pedagogy" }
];

const OFFICIAL_SKILLS = [
  // s1: AGRICULTURE
  { id: "sk_agr_1", skill_code: "SK-AGR-01", skill_name: "Fisheries / Aquaculture", sector_id: "s1", description: "Fish breeding, pond management and harvesting", lot_number: "LOT 1", duration_months: 6, duration_weeks: 24 },
  { id: "sk_agr_2", skill_code: "SK-AGR-02", skill_name: "Livestock Farming (Poultry)", sector_id: "s1", description: "Poultry management, feed production and disease control", lot_number: "LOT 2", duration_months: 6, duration_weeks: 24 },
  { id: "sk_agr_3", skill_code: "SK-AGR-03", skill_name: "Livestock Farming (Bee Keeping)", sector_id: "s1", description: "Beekeeping, apiary set up and honey extraction", lot_number: "LOT 2", duration_months: 6, duration_weeks: 24 },
  { id: "sk_agr_4", skill_code: "SK-AGR-04", skill_name: "Livestock Farming (Animal Husbandry)", sector_id: "s1", description: "Ruminant breeding, animal healthcare and housing", lot_number: "LOT 2", duration_months: 6, duration_weeks: 24 },
  { id: "sk_agr_5", skill_code: "SK-AGR-05", skill_name: "Crop Production & Processing", sector_id: "s1", description: "Land cultivation, crop planting, preservation and processing", lot_number: "LOT 3", duration_months: 6, duration_weeks: 24 },
  { id: "sk_agr_6", skill_code: "SK-AGR-06", skill_name: "Mechanized Agriculture (Operations)", sector_id: "s1", description: "Tractor operation, implement calibration and farming machinery usage", lot_number: "LOT 3", duration_months: 6, duration_weeks: 24 },
  { id: "sk_agr_7", skill_code: "SK-AGR-07", skill_name: "Mechanized Agriculture (Mechanics)", sector_id: "s1", description: "Advanced repair of tractors, generators and agricultural equipment", lot_number: "LOT 3A", duration_months: 12, duration_weeks: 48 },

  // s3: DIGITAL SKILLS (sk1 preserves Computer Hardware and Cell Phone Repairs)
  { id: "sk1", skill_code: "SK-COM-REP", skill_name: "Computer Hardware & Cell Phone Repairs", sector_id: "s3", description: "Micro-soldering, circuits diagnostic and operating system installation", lot_number: "LOT 4", duration_months: 6, duration_weeks: 24 },
  { id: "sk_ict_2", skill_code: "SK-ICT-02", skill_name: "Network System Installation", sector_id: "s3", description: "Cabling, routing, switch setup and signal configurations", lot_number: "LOT 4", duration_months: 6, duration_weeks: 24 },
  { id: "sk_ict_3", skill_code: "SK-ICT-03", skill_name: "Creative Media (Digital Media Production)", sector_id: "s3", description: "Photography, videography, lighting and audio post-processing", lot_number: "LOT 5", duration_months: 6, duration_weeks: 24 },

  // s5: HOSPITALITY, LEISURE, TOURISM & CREATIVE SERVICES
  { id: "sk_cre_1", skill_code: "SK-CRE-01", skill_name: "Baking & Confectionery", sector_id: "s5", description: "Oven operations, pastry dough management, decorating and confectioneries", lot_number: "LOT 6", duration_months: 6, duration_weeks: 24 },
  { id: "sk_cre_2", skill_code: "SK-CRE-02", skill_name: "Catering / Hospitality Management", sector_id: "s5", description: "Food preparation, hygiene standards, lodging and catering systems", lot_number: "LOT 6", duration_months: 6, duration_weeks: 24 },
  { id: "sk_cre_3", skill_code: "SK-CRE-03", skill_name: "Leather Works", sector_id: "s5", description: "Shoe, bag and belt design, tanning and stitching craft", lot_number: "LOT 7", duration_months: 6, duration_weeks: 24 },
  { id: "sk_cre_4", skill_code: "SK-CRE-04", skill_name: "Fashion Design & Garment Making", sector_id: "s5", description: "Apparel sketch, fabric cutting, industrial stitching and tailoring", lot_number: "LOT 8", duration_months: 12, duration_weeks: 48 },

  // s2: BUILDING CONSTRUCTION
  { id: "sk_con_1", skill_code: "SK-CON-01", skill_name: "Painting, Decoration & Interior Finishes", sector_id: "s2", description: "Surface preparation, texturing, wallpaper application and interior styling", lot_number: "LOT 9", duration_months: 6, duration_weeks: 24 },
  { id: "sk_con_2", skill_code: "SK-CON-02", skill_name: "Floor Cladding, Tiling & Interlocking", sector_id: "s2", description: "Levelling, tile layout selection, interlocking paving blocks installation", lot_number: "LOT 9", duration_months: 6, duration_weeks: 24 },
  { id: "sk_con_3", skill_code: "SK-CON-03", skill_name: "Plumbing & Pipe Fittings", sector_id: "s2", description: "Water distribution layouts, sanitary fixtures and drainage flow plumbing", lot_number: "LOT 9", duration_months: 6, duration_weeks: 24 },
  { id: "sk_con_4", skill_code: "SK-CON-04", skill_name: "Bricklaying, Blocklaying & Concreting (BBC)", sector_id: "s2", description: "Masonry blocks routing, bonding mixtures and concrete casting", lot_number: "LOT 9", duration_months: 6, duration_weeks: 24 },

  // s7: RENEWABLE ENERGY (sk2 preserves Solar Photovoltaic Panel Installation)
  { id: "sk2", skill_code: "SK-SOL-INS", skill_name: "Solar Panel / Inverter Installation & Maintenance", sector_id: "s7", description: "Photovoltaic cells routing, inverter battery chemistry, panel diagnostics", lot_number: "LOT 10", duration_months: 6, duration_weeks: 24 },
  { id: "sk_ren_2", skill_code: "SK-REN-02", skill_name: "Automobile CNG Conversion & Maintenance", sector_id: "s7", description: "CNG fuel kits extraction, pressure systems, calibration and safety", lot_number: "LOT 11", duration_months: 6, duration_weeks: 24 },

  // s4: ENGINEERING SERVICES
  { id: "sk_eng_1", skill_code: "SK-ENG-01", skill_name: "Furniture & Upholstery", sector_id: "s4", description: "Ergonomic foam padding, leather fabrics, spring assembly and carpentry", lot_number: "LOT 12", duration_months: 6, duration_weeks: 24 },
  { id: "sk_eng_2", skill_code: "SK-ENG-02", skill_name: "Woodwork, Carpentry & Joinery", sector_id: "s4", description: "Structural timber layouts, joints, roof carcass and cabinetry", lot_number: "LOT 12", duration_months: 6, duration_weeks: 24 },
  { id: "sk_eng_3", skill_code: "SK-ENG-03", skill_name: "Welding & Fabrication", sector_id: "s4", description: "Arc welding, gas cutting, structural iron welding and metal fabrication", lot_number: "LOT 13", duration_months: 6, duration_weeks: 24 },
  { id: "sk_eng_4", skill_code: "SK-ENG-04", skill_name: "Electrical Installation & Maintenance", sector_id: "s4", description: "Conduit wiring, circuit breaker layouts and industrial phase maintenance", lot_number: "LOT 14", duration_months: 6, duration_weeks: 24 },
  { id: "sk_eng_5", skill_code: "SK-ENG-05", skill_name: "Refrigeration & Air Conditioning", sector_id: "s4", description: "Compressor systems, refrigerant flow, AC repair and thermodynamic maintenance", lot_number: "LOT 14", duration_months: 6, duration_weeks: 24 },

  // s6: AUTOMOBILE SKILLS
  { id: "sk_aut_1", skill_code: "SK-AUT-01", skill_name: "Motorcycle & Tricycle Repairs", sector_id: "s6", description: "Two/three wheeler engine diagnostics, gear transmissions, and brakes", lot_number: "LOT 15", duration_months: 6, duration_weeks: 24 },
  { id: "sk_aut_2", skill_code: "SK-AUT-02", skill_name: "Vulcanizing & Tire Repairs", sector_id: "s6", description: "Tire balancing, alignment, pneumatic chamber seals and vulcanizing", lot_number: "LOT 15", duration_months: 6, duration_weeks: 24 },
  { id: "sk_aut_3", skill_code: "SK-AUT-03", skill_name: "Automobile Mechanics", sector_id: "s6", description: "Engine overhaul, transmission system assembly and hydraulic brakes", lot_number: "LOT 15", duration_months: 6, duration_weeks: 24 },
  { id: "sk_aut_4", skill_code: "SK-AUT-04", skill_name: "Auto Body Works (Panel Beating)", sector_id: "s6", description: "Dent pulling, gas cutting welding, metal chassis alignment and auto spray painting", lot_number: "LOT 15A", duration_months: 12, duration_weeks: 48 },

  // s8: BEAUTY COSMETOLOGY
  { id: "sk_cos_1", skill_code: "SK-COS-01", skill_name: "Hair Styling", sector_id: "s8", description: "Braiding, relaxing, texturing, hair weaving and custom hair styling", lot_number: "LOT 16", duration_months: 6, duration_weeks: 24 },
  { id: "sk_cos_2", skill_code: "SK-COS-02", skill_name: "Make-Up", sector_id: "s8", description: "Cosmetics matching, contouring, bridal makeups and facial treatment", lot_number: "LOT 16", duration_months: 6, duration_weeks: 24 },
  { id: "sk_cos_3", skill_code: "SK-COS-03", skill_name: "Gele Tying", sector_id: "s8", description: "Traditional head-ties, layered pleating and customizable gele art", lot_number: "LOT 16", duration_months: 6, duration_weeks: 24 },
  { id: "sk_cos_4", skill_code: "SK-COS-04", skill_name: "Bead Making", sector_id: "s8", description: "Bead threading, jewelry designs, wireworks and souvenir accessory designs", lot_number: "LOT 17", duration_months: 6, duration_weeks: 24 },
  { id: "sk_cos_5", skill_code: "SK-COS-05", skill_name: "Wig Making", sector_id: "s8", description: "Weft creation, closure ventilation, custom ventilating and wig care", lot_number: "LOT 17", duration_months: 6, duration_weeks: 24 },
  { id: "sk_cos_6", skill_code: "SK-COS-06", skill_name: "Perfume Making", sector_id: "s8", description: "Fragrance extraction, essential oil formulations and perfume bottling", lot_number: "LOT 17", duration_months: 6, duration_weeks: 24 },

  // s9: CHILDCARE
  { id: "sk_chd_1", skill_code: "SK-CHD-01", skill_name: "Early Child Education & Development", sector_id: "s9", description: "Pedagogical play, child nursing safety, cognitive growth development support", lot_number: "LOT 18", duration_months: 6, duration_weeks: 24 },

  // s10: EDUCATION
  { id: "sk_edu_1", skill_code: "SK-EDU-01", skill_name: "Technical Teachers Training", sector_id: "s10", description: "Vocational instruction modeling, syllabus formulation and technical pedagogy", lot_number: "LOT 19", duration_months: 6, duration_weeks: 24 }
];

const ZONES = ["North Central", "North East", "North West", "South East", "South South", "South West"];

async function runMigration() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("=== START DATABASE SCHEMA REWRITE & METADATA SEEDIGN ===");

    // Add columns dynamically to skills table if they do not exist
    await pool.query(`
      ALTER TABLE skills ADD COLUMN IF NOT EXISTS lot_number VARCHAR(100);
      ALTER TABLE skills ADD COLUMN IF NOT EXISTS duration_months INT DEFAULT 6;
    `);
    console.log("- Added lot_number and duration_months to skills table.");

    // Create skill_zones normalized table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS skill_zones (
        skill_id VARCHAR(50) NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
        zone_name VARCHAR(50) NOT NULL,
        PRIMARY KEY (skill_id, zone_name)
      );
    `);
    console.log("- Created skill_zones table.");

    // Create tsp_sectors normalized governance table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tsp_sectors (
        tsp_id UUID NOT NULL REFERENCES tsps(id) ON DELETE CASCADE,
        sector_id VARCHAR(50) NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (tsp_id, sector_id)
      );
    `);
    console.log("- Created tsp_sectors table.");

    // Create tsp_skills normalized governance table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tsp_skills (
        tsp_id UUID NOT NULL REFERENCES tsps(id) ON DELETE CASCADE,
        skill_id VARCHAR(50) NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (tsp_id, skill_id)
      );
    `);
    console.log("- Created tsp_skills table.");

    // Ingest Sectors (Idempotent ON CONFLICT update)
    console.log("- Ingesting Official Sectors...");
    for (const sec of OFFICIAL_SECTORS) {
      await pool.query(`
        INSERT INTO sectors (id, sector_code, sector_name, description, status)
        VALUES ($1, $2, $3, $4, 'ACTIVE')
        ON CONFLICT (id) DO UPDATE SET 
          sector_code = EXCLUDED.sector_code,
          sector_name = EXCLUDED.sector_name,
          description = EXCLUDED.description,
          updated_at = NOW()
      `, [sec.id, sec.sector_code, sec.sector_name, sec.description]);
    }

    // Ingest Skills (Idempotent ON CONFLICT update)
    console.log("- Ingesting Official Skills...");
    for (const sk of OFFICIAL_SKILLS) {
      // Create associated sector references just in case there's any mismatch
      await pool.query(`
        INSERT INTO skills (id, skill_code, skill_name, sector_id, description, lot_number, duration_months, duration_weeks, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE')
        ON CONFLICT (id) DO UPDATE SET 
          skill_code = EXCLUDED.skill_code,
          skill_name = EXCLUDED.skill_name,
          sector_id = EXCLUDED.sector_id,
          description = EXCLUDED.description,
          lot_number = EXCLUDED.lot_number,
          duration_months = EXCLUDED.duration_months,
          duration_weeks = EXCLUDED.duration_weeks,
          updated_at = NOW()
      `, [sk.id, sk.skill_code, sk.skill_name, sk.sector_id, sk.description, sk.lot_number, sk.duration_months, sk.duration_weeks]);

      // Seed perfect default national coverage zones
      for (const zone of ZONES) {
        await pool.query(`
          INSERT INTO skill_zones (skill_id, zone_name)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [sk.id, zone]);
      }
    }

    // Preserve "Unique Technology Nig. Ltd" mapping to Sector s3 (DIGITAL SKILLS) and Skill sk1 (Computer Hardware & Cell Phone Repairs)
    console.log("- Mapping Unique Technology Nig. Ltd to Digital Skills...");
    const tspId = "00000000-0000-0000-0000-000000000001";
    
    // Check if TSP exists in DB first
    const tspCheck = await pool.query("SELECT id FROM tsps WHERE id = $1", [tspId]);
    if (tspCheck.rowCount > 0) {
      await pool.query(`
        INSERT INTO tsp_sectors (tsp_id, sector_id)
        VALUES ($1, 's3')
        ON CONFLICT DO NOTHING
      `, [tspId]);

      await pool.query(`
        INSERT INTO tsp_skills (tsp_id, skill_id)
        VALUES ($1, 'sk1')
        ON CONFLICT DO NOTHING
      `, [tspId]);
      
      console.log("  Successfully registered sector s3 and skill sk1 assignments for Unique Technology.");
    } else {
      console.warn("  Unique Technology TSP could not be found to seed assignments directly!");
    }

    console.log("=== MIGRATION AND SEEDING COMPLETED SUCCESSFULLY ===");
  } catch (err: any) {
    console.error("Migration fatal error:", err);
  } finally {
    await pool.end();
  }
}

runMigration();
