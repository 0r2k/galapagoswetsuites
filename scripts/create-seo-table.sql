-- Create table for SEO and hero content
CREATE TABLE IF NOT EXISTS site_content (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    -- Hero content (Spanish)
    hero_title_es TEXT,
    hero_subtitle_es TEXT,
    hero_description_es TEXT,
    hero_sizes_note_es TEXT,
    -- Hero content (English)
    hero_title_en TEXT,
    hero_subtitle_en TEXT,
    hero_description_en TEXT,
    hero_sizes_note_en TEXT,
    -- SEO metadata (Spanish)
    seo_title_es TEXT,
    seo_description_es TEXT,
    og_title_es TEXT,
    og_description_es TEXT,
    og_image_es TEXT,
    twitter_title_es TEXT,
    twitter_description_es TEXT,
    -- SEO metadata (English)
    seo_title_en TEXT,
    seo_description_en TEXT,
    og_title_en TEXT,
    og_description_en TEXT,
    og_image_en TEXT,
    twitter_title_en TEXT,
    twitter_description_en TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;

-- Create RLS policies:
-- 1. Allow public read access (for the main website)
CREATE POLICY "Allow public read access"
    ON site_content
    FOR SELECT
    USING (true);

-- 2. Allow authenticated users full access (for admin panel)
CREATE POLICY "Allow authenticated full access"
    ON site_content
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Create a trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_site_content_updated_at
    BEFORE UPDATE ON site_content
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert initial default content if no rows exist
INSERT INTO site_content (
    hero_title_es, hero_subtitle_es, hero_description_es, hero_sizes_note_es,
    hero_title_en, hero_subtitle_en, hero_description_en, hero_sizes_note_en,
    seo_title_es, seo_description_es, og_title_es, og_description_es,
    seo_title_en, seo_description_en, og_title_en, og_description_en
)
SELECT 
    -- Default hero content (Spanish)
    'Alquiler de Trajes de Neopreno y Equipo de Snorkel',
    '¡Tu aventura submarina empieza aquí!',
    'Equipo de alta calidad para explorar las aguas cristalinas de Galápagos. Trajes de neopreno, snorkeles, aletas y más.',
    'Elige tu talla perfecta',
    -- Default hero content (English)
    'Wetsuit and Snorkel Gear Rental',
    'Your underwater adventure starts here!',
    'High-quality equipment to explore the crystal-clear waters of Galápagos. Wetsuits, snorkels, fins and more.',
    'Choose your perfect size',
    -- Default SEO (Spanish)
    'Alquiler de Trajes de Neopreno Galápagos | Equipo de Snorkel',
    'Alquila trajes de neopreno y equipo de snorkel de alta calidad en Galápagos. Explora las Islas Galápagos con el mejor equipo.',
    'Alquiler de Trajes de Neopreno Galápagos',
    'Alquila trajes de neopreno y equipo de snorkel de alta calidad en Galápagos.',
    -- Default SEO (English)
    'Galápagos Wetsuit Rental | Snorkel Gear',
    'Rent high-quality wetsuits and snorkel gear in Galápagos. Explore the Galápagos Islands with the best equipment.',
    'Galápagos Wetsuit Rental',
    'Rent high-quality wetsuits and snorkel gear in Galápagos.'
WHERE NOT EXISTS (SELECT 1 FROM site_content);
