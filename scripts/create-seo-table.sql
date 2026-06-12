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
    'Alquiler de wetsuits y snorkel en Galápagos',
    '<strong>Tenemos wetsuit cortos y largos de todas las tallas</strong>, equipos de snorkel con aletas y GoPro Hero11 Black, <strong>todo en excelentes condiciones</strong> para que tengas una experiencia espectacular en las Islas Galápagos.',
    '<strong>Puedes rentarlo en linea</strong> y lo mejor es que te lo podemos <strong>entregar en tu hotel/hostal</strong>, o tambien <strong>lo puedes recoger en la oficina</strong> de la agencia en la Isla Santa Cruz.',
    'No te preocupes si no sabes tu talla para el wetsuit, tenemos todas las tallas para que te pruebes.',
    -- Default hero content (English)
    'Wetsuit and Snorkel Rental in Galápagos',
    '<strong>We have short and long wetsuits in all sizes</strong>, snorkeling gear with fins and GoPro Hero11 Black, <strong>all in excellent condition</strong> for you to have an amazing experience in the Galápagos Islands.',
    '<strong>You can rent it online</strong> and best of all, we can <strong>deliver it to your hotel/hostel</strong>, or you can also <strong>pick it up at the agency office</strong> on Santa Cruz Island.',
    'Don''t worry if you don''t know your wetsuit size, we have all sizes for you to try.',
    -- Default SEO (Spanish)
    'Galapagos: Alquiler de Wetsuit corto y largo, equipo de snorkel, aletas, GoPro Hero11 Black, Reserva en linea',
    'Tenemos más de 100 trajes wetsuit y equipos de snorkel en perfectas condiciones para rentarlos en la Isla Santa Cruz Galápagos, Resérvalo en línea.',
    'Galápagos - Wetsuit & Snorkeling by ChokoTrip',
    'Alquiler de equipos de snorkeling y wetsuits en Galápagos. Más de 100 equipos disponibles para explorar la vida marina. Recogida en Santa Cruz, devolución en Santa Cruz o San Cristóbal.',
    -- Default SEO (English)
    'Galapagos: Short and Long Wetsuit Rental, Snorkeling Gear, Fins, GoPro Hero11 Black, Online Reservation',
    'We have more than 100 wetsuits and snorkeling gear in perfect condition for rent on Santa Cruz Island Galápagos, Reserve it online.',
    'Galápagos - Wetsuit & Snorkeling by ChokoTrip',
    'Snorkeling and wetsuit equipment rental in Galápagos. More than 100 sets available to explore marine life. Pickup in Santa Cruz, drop-off in Santa Cruz or San Cristóbal.'
WHERE NOT EXISTS (SELECT 1 FROM site_content);
