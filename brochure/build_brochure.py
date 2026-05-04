"""
Peppy Taps — Sales Brochure Generator

Builds a multi-page A4 PDF brochure pulling product, pricing, SKU and brand
content directly from what's already on the site. Uses brand colours and
typography to match peppytaps.com.au.
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle,
    PageBreak, KeepTogether, Frame, PageTemplate, BaseDocTemplate
)
from reportlab.platypus.flowables import HRFlowable
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# ---------------------------------------------------------------------------
# Brand
# ---------------------------------------------------------------------------
BRAND_DARK   = HexColor('#1d3a5f')   # Navy
BRAND_BG     = HexColor('#fafaf8')   # Off-white page bg
BRAND_CREAM  = HexColor('#f0e2c5')   # Accent cream
BRAND_TEXT   = HexColor('#1a1a1a')
BRAND_MUTED  = HexColor('#6b6b6b')
BRAND_BORDER = HexColor('#e8e6e1')

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = '/Users/dan-mbp/Claude/tapware-site'
IMG = os.path.join(ROOT, 'img')
PRODUCTS = os.path.join(IMG, 'products')
LIFESTYLE = os.path.join(IMG, 'lifestyle')
LOGO_WHITE = os.path.join(IMG, 'logo', 'peppy-logo-white.png')
LOGO_BLACK = os.path.join(IMG, 'logo', 'peppy-logo-black.png')
OUT = os.path.join(ROOT, 'brochure', 'PeppyTaps_Brochure.pdf')

# ---------------------------------------------------------------------------
# Styles
# ---------------------------------------------------------------------------
styles = getSampleStyleSheet()

H_HERO = ParagraphStyle('Hero', parent=styles['Title'],
    fontName='Helvetica-Bold', fontSize=42, leading=48,
    textColor=white, alignment=TA_CENTER, spaceAfter=8)

H_HERO_SUB = ParagraphStyle('HeroSub', parent=styles['Normal'],
    fontName='Helvetica', fontSize=12, leading=18,
    textColor=BRAND_CREAM, alignment=TA_CENTER, spaceAfter=4,
    letterSpacing=2)

H_TITLE = ParagraphStyle('Title', parent=styles['Title'],
    fontName='Helvetica-Bold', fontSize=28, leading=34,
    textColor=BRAND_DARK, alignment=TA_LEFT, spaceAfter=8)

H_TITLE_C = ParagraphStyle('TitleC', parent=H_TITLE, alignment=TA_CENTER)

H_SECTION = ParagraphStyle('Section', parent=styles['Normal'],
    fontName='Helvetica-Bold', fontSize=10, leading=14,
    textColor=BRAND_DARK, alignment=TA_LEFT, spaceAfter=12,
    spaceBefore=0)

H_EYEBROW = ParagraphStyle('Eyebrow', parent=H_SECTION, alignment=TA_CENTER)

H_PRODUCT = ParagraphStyle('Product', parent=styles['Title'],
    fontName='Helvetica-Bold', fontSize=22, leading=28,
    textColor=BRAND_TEXT, spaceAfter=4)

H_BADGE = ParagraphStyle('Badge', parent=styles['Normal'],
    fontName='Helvetica-Bold', fontSize=8, leading=10,
    textColor=white, alignment=TA_LEFT, spaceAfter=8)

H_PRICE = ParagraphStyle('Price', parent=styles['Normal'],
    fontName='Helvetica-Bold', fontSize=20, leading=24,
    textColor=BRAND_DARK, spaceAfter=2)

BODY = ParagraphStyle('Body', parent=styles['Normal'],
    fontName='Helvetica', fontSize=10, leading=15,
    textColor=BRAND_TEXT, alignment=TA_LEFT, spaceAfter=8)

BODY_C = ParagraphStyle('BodyC', parent=BODY, alignment=TA_CENTER)
BODY_J = ParagraphStyle('BodyJ', parent=BODY, alignment=TA_JUSTIFY)

LEAD = ParagraphStyle('Lead', parent=BODY,
    fontSize=12, leading=18, textColor=BRAND_TEXT, spaceAfter=12)

LEAD_C = ParagraphStyle('LeadC', parent=LEAD, alignment=TA_CENTER)

CAPTION = ParagraphStyle('Caption', parent=styles['Normal'],
    fontName='Helvetica', fontSize=8, leading=12,
    textColor=BRAND_MUTED, spaceAfter=4)

LABEL = ParagraphStyle('Label', parent=styles['Normal'],
    fontName='Helvetica-Bold', fontSize=8, leading=12,
    textColor=BRAND_DARK, spaceAfter=2)

# ---------------------------------------------------------------------------
# Product data (mirrors what's on each PDP)
# ---------------------------------------------------------------------------
PRODUCT_DATA = [
    {
        'name': 'Signature 5 in 1',
        'tagline': 'Filtered Boiling + Filtered Chilled + Chilled Soda + Hot & Cold Mains',
        'badge': 'Signature Collection',
        'image': os.path.join(PRODUCTS, 'sig5in1-chrome.png'),
        'description': (
            'Our flagship system. Touch-control digital panel delivers boiling water at '
            'seven adjustable temperatures (75°-98°C), filtered chilled, and sparkling '
            'soda water — alongside standard hot and cold mains. The complete kitchen '
            'experience in a single, beautifully engineered tap.'
        ),
        'features': [
            'Touch-control digital panel',
            '7 boiling temperature settings (75°-98°C)',
            'Filtered chilled water',
            'Filtered sparkling (soda) water',
            'Hot & cold mains',
            'NSF 42 certified filtration',
        ],
        'sku_prefix': '5IN1BCSELEC',
        'finishes': [
            ('Chrome',             'CH',  4999),
            ('Matte Black',        'MB',  5299),
            ('Gun Metal Grey',     'GMG', 5499),
            ('Brushed Nickel',     'BN',  5499),
            ('Brushed Brass Gold', 'BBG', 5499),
        ],
    },
    {
        'name': 'Signature 4 in 1',
        'tagline': 'Filtered Boiling + Filtered Ambient + Hot & Cold Mains',
        'badge': 'Signature Collection',
        'image': os.path.join(PRODUCTS, 'sig4in1-chrome.png'),
        'description': (
            'The Signature 4-in-1 brings touch-control technology and seven boiling '
            'temperatures to a slimline kitchen tap. Filtered boiling, filtered ambient, '
            'and hot & cold mains — refined design without the soda function.'
        ),
        'features': [
            'Touch-control digital panel',
            '7 boiling temperature settings (75°-98°C)',
            'Filtered ambient (room temp) water',
            'Hot & cold mains',
            'NSF 42 certified filtration',
        ],
        'sku_prefix': '4IN1BAELEC',
        'finishes': [
            ('Chrome',             'CH',  2999),
            ('Matte Black',        'MB',  3199),
            ('Gun Metal Grey',     'GMG', 3299),
            ('Brushed Nickel',     'BN',  3299),
            ('Brushed Brass Gold', 'BBG', 3299),
        ],
    },
    {
        'name': 'Signature Pull Out 4 in 1',
        'tagline': 'Filtered Boiling + Filtered Ambient + Hot & Cold Mains with Retractable Hose',
        'badge': 'Signature Collection',
        'image': os.path.join(PRODUCTS, 'sigpullout-chrome.png'),
        'description': (
            'All the function of the Signature 4-in-1, with the added flexibility of a '
            'retractable pull-out hose for filling pots, rinsing produce, and cleaning '
            'the sink. Touch-control panel, seven temperatures, transparent design.'
        ),
        'features': [
            'Touch-control digital panel',
            '7 boiling temperature settings (75°-98°C)',
            'Filtered ambient water',
            'Retractable pull-out hose',
            'Hot & cold mains',
            'NSF 42 certified filtration',
        ],
        'sku_prefix': '4IN1BAELECPO',
        'finishes': [
            ('Chrome',             'CH',  3499),
            ('Matte Black',        'MB',  3699),
            ('Gun Metal Grey',     'GMG', 3799),
            ('Brushed Nickel',     'BN',  3799),
            ('Brushed Brass Gold', 'BBG', 3799),
        ],
    },
    {
        'name': 'Flagship 4 in 1',
        'tagline': 'Filtered Boiling + Ambient + Hot & Cold Mains',
        'badge': 'Flagship Collection',
        'image': os.path.join(PRODUCTS, 'flagship-chrome-transparent.png'),
        'description': (
            'Streamlined design, lever-style operation. Fixed 98°C boiling water on '
            'demand, filtered ambient, and hot & cold mains. Clean lines and effortless '
            'function for those who want the essentials beautifully done.'
        ),
        'features': [
            'Lever-style 98°C boiling',
            'Filtered ambient water',
            'Hot & cold mains',
            'No digital interface — clean look',
            'NSF 42 certified filtration',
        ],
        'sku_prefix': '4IN1BA',
        'finishes': [
            ('Chrome',             'CH',  2499),
            ('Matte Black',        'MB',  2799),
            ('Gun Metal Grey',     'GMG', 2999),
            ('Brushed Nickel',     'BN',  2999),
            ('Brushed Brass Gold', 'BBG', 2999),
        ],
    },
    {
        'name': 'Flagship Pull Out 4 in 1',
        'tagline': 'Filtered Boiling + Ambient + Hot & Cold Mains with Retractable Hose',
        'badge': 'Flagship Collection',
        'image': os.path.join(PRODUCTS, 'pullout-chrome-transparent.png'),
        'description': (
            'The Flagship Pull Out adds a retractable hose to our streamlined 4-in-1 '
            'design. Lever-style boiling, filtered ambient, hot & cold mains — with the '
            'reach you need for everyday kitchen tasks.'
        ),
        'features': [
            'Lever-style 98°C boiling',
            'Filtered ambient water',
            'Retractable pull-out hose',
            'Hot & cold mains',
            'NSF 42 certified filtration',
        ],
        'sku_prefix': '4IN1BAPO',
        'finishes': [
            ('Chrome',             'CH',  2999),
            ('Matte Black',        'MB',  3299),
            ('Gun Metal Grey',     'GMG', 3499),
            ('Brushed Nickel',     'BN',  3499),
            ('Brushed Brass Gold', 'BBG', 3499),
        ],
    },
]

FINISH_DESCRIPTIONS = [
    ('Chrome',             'Mirror-polished. Timeless elegance that suits any kitchen aesthetic.'),
    ('Matte Black',        'Bold contemporary sophistication. Pairs beautifully with timber, stone and concrete.'),
    ('Gun Metal Grey',     'Industrial refined edge. Soft enough for warm interiors, sharp enough for modern.'),
    ('Brushed Nickel',     'Subtle understated warmth. A timeless alternative to chrome with brushed texture.'),
    ('Brushed Brass Gold', 'Warm luxurious character. The statement finish for design-forward kitchens.'),
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def fmt_price(p):
    return f"${p:,}"


def background_canvas(canvas_obj, doc, fill_color=BRAND_BG, footer_text=None,
                      page_num=True):
    """Draw page background, footer line and page number."""
    canvas_obj.saveState()
    # Background
    canvas_obj.setFillColor(fill_color)
    canvas_obj.rect(0, 0, A4[0], A4[1], stroke=0, fill=1)
    # Footer rule
    canvas_obj.setStrokeColor(BRAND_BORDER)
    canvas_obj.setLineWidth(0.5)
    canvas_obj.line(15 * mm, 15 * mm, A4[0] - 15 * mm, 15 * mm)
    # Footer brand
    canvas_obj.setFillColor(BRAND_MUTED)
    canvas_obj.setFont('Helvetica', 7)
    canvas_obj.drawString(15 * mm, 10 * mm, 'PEPPY TAPS — peppytaps.com.au')
    # Page number
    if page_num:
        canvas_obj.drawRightString(A4[0] - 15 * mm, 10 * mm,
            f'{doc.page:02d}')
    # Footer text (e.g. section name)
    if footer_text:
        canvas_obj.drawCentredString(A4[0] / 2, 10 * mm, footer_text)
    canvas_obj.restoreState()


def cover_canvas(canvas_obj, doc):
    """Cover page — solid navy background, hero photo, logo, tagline."""
    canvas_obj.saveState()
    # Solid navy background
    canvas_obj.setFillColor(BRAND_DARK)
    canvas_obj.rect(0, 0, A4[0], A4[1], stroke=0, fill=1)
    # Hero photo (top half)
    try:
        canvas_obj.drawImage(
            os.path.join(LIFESTYLE, 'hero1.jpg'),
            0, A4[1] * 0.45, A4[0], A4[1] * 0.55,
            preserveAspectRatio=True, anchor='c', mask='auto'
        )
    except Exception:
        pass
    # Dark overlay on photo for legibility
    canvas_obj.setFillColorRGB(0.11, 0.23, 0.37, alpha=0.55)
    canvas_obj.rect(0, A4[1] * 0.45, A4[0], A4[1] * 0.55, stroke=0, fill=1)
    # Logo top-left
    try:
        canvas_obj.drawImage(LOGO_WHITE,
            20 * mm, A4[1] - 32 * mm, width=42 * mm, height=14 * mm,
            preserveAspectRatio=True, mask='auto')
    except Exception:
        canvas_obj.setFillColor(white)
        canvas_obj.setFont('Helvetica-Bold', 22)
        canvas_obj.drawString(20 * mm, A4[1] - 28 * mm, 'PEPPY TAPS')
    # Year stamp top-right
    canvas_obj.setFillColor(white)
    canvas_obj.setFont('Helvetica', 9)
    canvas_obj.drawRightString(A4[0] - 20 * mm, A4[1] - 25 * mm,
        '2026 PRODUCT GUIDE')
    canvas_obj.restoreState()


def divider(width=None, thickness=0.6, color=BRAND_BORDER, before=8, after=8):
    return HRFlowable(width=width or '100%', thickness=thickness,
        color=color, spaceBefore=before, spaceAfter=after)


def make_finish_swatch_table(finishes_with_skus_and_prices, sku_prefix):
    """Return a Table flowable showing the finish/SKU/price matrix."""
    header = [
        Paragraph('<b>Finish</b>', LABEL),
        Paragraph('<b>SKU</b>', LABEL),
        Paragraph('<b>RRP (incl. GST)</b>', LABEL),
    ]
    data = [header]
    for name, suffix, price in finishes_with_skus_and_prices:
        data.append([
            Paragraph(name, BODY),
            Paragraph(f'<font name="Courier">{sku_prefix}{suffix}</font>', BODY),
            Paragraph(fmt_price(price), BODY),
        ])
    t = Table(data, colWidths=[55 * mm, 55 * mm, 40 * mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_DARK),
        ('TEXTCOLOR',  (0, 0), (-1, 0), white),
        ('FONTNAME',   (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE',   (0, 0), (-1, 0), 9),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 1), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 7),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, BRAND_BG]),
        ('LINEBELOW', (0, 0), (-1, -1), 0.25, BRAND_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    # Override the header text colour to white (TableStyle on Paragraphs needs the explicit color)
    return t


def features_list(features):
    """Bulleted list of key features."""
    items = []
    for f in features:
        items.append(Paragraph(f'• {f}', BODY))
    return items


def product_image_flowable(path, width=80 * mm, height=110 * mm):
    if not os.path.exists(path):
        return Paragraph('[image]', CAPTION)
    return Image(path, width=width, height=height, kind='proportional')


# ---------------------------------------------------------------------------
# Document build
# ---------------------------------------------------------------------------

def build_brochure():
    doc = BaseDocTemplate(
        OUT, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=22 * mm, bottomMargin=22 * mm,
        title='Peppy Taps — 2026 Product Guide',
        author='Peppy Taps',
        subject='Product brochure for the Signature & Flagship collections',
    )

    # --- Page templates ---
    frame_full = Frame(
        20 * mm, 20 * mm,
        A4[0] - 40 * mm, A4[1] - 42 * mm,
        leftPadding=0, bottomPadding=0,
        rightPadding=0, topPadding=0,
        showBoundary=0,
    )

    cover_template = PageTemplate(id='Cover', frames=[frame_full],
        onPage=cover_canvas)
    page_template  = PageTemplate(id='Page',  frames=[frame_full],
        onPage=background_canvas)

    doc.addPageTemplates([cover_template, page_template])

    story = []

    # ------------------------------------------------------------
    # COVER PAGE
    # ------------------------------------------------------------
    # The cover content sits on top of the canvas drawing (see cover_canvas).
    # We push the body content down so it lands on the lower half of the page.
    story.append(Spacer(1, A4[1] * 0.45 - 22 * mm))
    story.append(Paragraph('WHERE GREAT DESIGN MEETS EVERYDAY EASE', H_HERO_SUB))
    story.append(Spacer(1, 12))
    story.append(Paragraph('Convenience.<br/>Sustainability.<br/>Aesthetics.', H_HERO))
    story.append(Spacer(1, 18))
    story.append(Paragraph(
        'Filtered boiling at 98°C. Chilled. Sparkling. Hot &amp; cold mains — '
        'with a pull-out mixer for ultimate flexibility. Up to five functions '
        'from a single, beautifully designed kitchen tap.',
        ParagraphStyle('CoverLead', parent=BODY_C,
            fontSize=11, leading=18, textColor=white, spaceAfter=0)
    ))
    story.append(PageBreak())

    # Switch to standard page template
    story.append(Spacer(0, 0))  # ensure next page uses 'Page' template
    # Force template switch
    from reportlab.platypus.doctemplate import NextPageTemplate
    story.insert(len(story) - 1, NextPageTemplate('Page'))

    # ------------------------------------------------------------
    # PAGE 2 — Brand intro
    # ------------------------------------------------------------
    story.append(Paragraph('OUR STORY', H_EYEBROW))
    story.append(Paragraph('Where Great Design Meets Everyday Ease', H_TITLE_C))
    story.append(Spacer(1, 16))
    story.append(Paragraph(
        'Peppy Taps was founded on a simple belief: that convenience, '
        'sustainability and aesthetics should come together in one tap. '
        'We design multi-function kitchen taps that deliver filtered boiling '
        'water at 98°C, filtered chilled or ambient water, and standard hot '
        'and cold mains — all through a single, elegantly designed fixture.',
        BODY_J,
    ))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        'Our Signature Collection features innovative touch-control '
        'technology with integrated digital panels, while our Flagship '
        'Collection offers streamlined simplicity. Every tap is available in '
        'five premium finishes and is backed by our commitment to quality, '
        'sustainability, and thoughtful Australian design.',
        BODY_J,
    ))
    story.append(divider(before=24, after=24))

    # Three stats row
    stats_data = [[
        Paragraph('<font size=24 color="#1d3a5f"><b>5</b></font><br/>'
                  '<font size=8 color="#6b6b6b">PREMIUM FINISHES</font>',
                  BODY_C),
        Paragraph('<font size=24 color="#1d3a5f"><b>5 in 1</b></font><br/>'
                  '<font size=8 color="#6b6b6b">MAXIMUM FUNCTIONS</font>',
                  BODY_C),
        Paragraph('<font size=24 color="#1d3a5f"><b>98°C</b></font><br/>'
                  '<font size=8 color="#6b6b6b">INSTANT BOILING</font>',
                  BODY_C),
    ]]
    stats = Table(stats_data, colWidths=[55 * mm, 55 * mm, 55 * mm])
    stats.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    story.append(stats)
    story.append(divider(before=24, after=24))

    # Trust badges row
    trust_data = [[
        Paragraph('<b>WaterMark<br/>Certified</b>', BODY_C),
        Paragraph('<b>NSF 42<br/>Filtration</b>', BODY_C),
        Paragraph('<b>Lead<br/>Free</b>', BODY_C),
        Paragraph('<b>2-Year<br/>Warranty</b>', BODY_C),
        Paragraph('<b>Australian<br/>Owned</b>', BODY_C),
    ]]
    trust = Table(trust_data, colWidths=[34 * mm] * 5)
    trust.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 16),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 16),
        ('BACKGROUND', (0, 0), (-1, -1), white),
        ('LINEBEFORE', (1, 0), (-1, -1), 0.5, BRAND_BORDER),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 0), (-1, -1), BRAND_DARK),
    ]))
    story.append(trust)
    story.append(PageBreak())

    # ------------------------------------------------------------
    # PAGE 3 — Collections overview
    # ------------------------------------------------------------
    story.append(Paragraph('COLLECTIONS', H_EYEBROW))
    story.append(Paragraph('Two Collections. One Beautiful Tap.', H_TITLE_C))
    story.append(Spacer(1, 14))
    story.append(Paragraph(
        'Choose the collection that suits your kitchen — and your lifestyle.',
        LEAD_C,
    ))
    story.append(Spacer(1, 20))

    # Two-column layout
    sig_cell = [
        Paragraph('SIGNATURE COLLECTION', H_SECTION),
        Paragraph('Premium Touch-Control', H_PRODUCT),
        Spacer(1, 6),
        Paragraph(
            'Integrated digital panels with seven adjustable boiling '
            'temperature settings (75°-98°C). Available in 4-in-1 and 5-in-1 '
            'configurations, with optional pull-out hose.',
            BODY,
        ),
        Spacer(1, 6),
        Paragraph('• Touch-control digital interface', BODY),
        Paragraph('• 7 boiling temperature settings', BODY),
        Paragraph('• Up to 5 water functions', BODY),
        Paragraph('• Pull-out option available', BODY),
        Spacer(1, 8),
        Paragraph('From <b>$2,999</b> RRP', H_PRICE),
    ]
    flag_cell = [
        Paragraph('FLAGSHIP COLLECTION', H_SECTION),
        Paragraph('Streamlined Simplicity', H_PRODUCT),
        Spacer(1, 6),
        Paragraph(
            'Lever-style 98°C boiling for those who want clean lines and '
            'effortless function. 4-in-1 configuration with optional pull-out '
            'hose — the essentials beautifully designed.',
            BODY,
        ),
        Spacer(1, 6),
        Paragraph('• Lever-style operation', BODY),
        Paragraph('• Fixed 98°C boiling', BODY),
        Paragraph('• 4 water functions', BODY),
        Paragraph('• Pull-out option available', BODY),
        Spacer(1, 8),
        Paragraph('From <b>$2,499</b> RRP', H_PRICE),
    ]

    coll_table = Table(
        [[sig_cell, flag_cell]],
        colWidths=[82.5 * mm, 82.5 * mm]
    )
    coll_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 16),
        ('RIGHTPADDING', (0, 0), (-1, -1), 16),
        ('TOPPADDING', (0, 0), (-1, -1), 20),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 20),
        ('BACKGROUND', (0, 0), (-1, -1), white),
        ('LINEAFTER', (0, 0), (0, -1), 0.5, BRAND_BORDER),
    ]))
    story.append(coll_table)
    story.append(PageBreak())

    # ------------------------------------------------------------
    # PER-PRODUCT PAGES
    # ------------------------------------------------------------
    for product in PRODUCT_DATA:
        # Top: badge + product title + tagline + price
        story.append(Paragraph(product['badge'].upper(), H_SECTION))
        story.append(Paragraph(product['name'], H_PRODUCT))
        story.append(Paragraph(product['tagline'], BODY))
        story.append(Spacer(1, 6))
        story.append(Paragraph(
            f"From <b>{fmt_price(product['finishes'][0][2])}</b> RRP "
            f'<font size=8 color="#6b6b6b">incl. GST</font>',
            H_PRICE
        ))
        story.append(Spacer(1, 12))

        # Two columns: image left | description+features right
        img = product_image_flowable(product['image'], width=72 * mm,
                                     height=100 * mm)

        right_cell = [
            Paragraph(product['description'], BODY_J),
            Spacer(1, 10),
            Paragraph('KEY FEATURES', H_SECTION),
        ] + features_list(product['features'])

        side_table = Table(
            [[img, right_cell]],
            colWidths=[78 * mm, 87 * mm]
        )
        side_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('LEFTPADDING', (1, 0), (1, 0), 14),
        ]))
        story.append(side_table)

        story.append(divider(before=22, after=12))
        story.append(Paragraph('AVAILABLE FINISHES &amp; SKUS', H_SECTION))
        story.append(Spacer(1, 4))
        story.append(make_finish_swatch_table(product['finishes'],
                                              product['sku_prefix']))
        story.append(PageBreak())

    # ------------------------------------------------------------
    # FILTER CARTRIDGE
    # ------------------------------------------------------------
    story.append(Paragraph('FILTERS &amp; SPARE PARTS', H_EYEBROW))
    story.append(Paragraph('Replacement Filters', H_TITLE_C))
    story.append(Spacer(1, 16))
    story.append(Paragraph(
        'The 2CB5-S cartridge is NSF Standard 42 certified, reducing '
        'chlorine, taste, odour, and sediment down to 5 microns. Replace '
        'every 12 months for optimal performance.',
        LEAD_C,
    ))
    story.append(Spacer(1, 24))

    filter_img_path = os.path.join(PRODUCTS, 'filter-cartridge.png')
    filter_img = product_image_flowable(filter_img_path, width=60 * mm,
                                        height=80 * mm)

    filter_cell = [
        Paragraph('2CB5-S Filter Cartridge', H_PRODUCT),
        Paragraph('NSF Standard 42 Certified Replacement Filter', BODY),
        Spacer(1, 8),
        Paragraph(f'<b>{fmt_price(179)}</b> '
                  f'<font size=8 color="#6b6b6b">AUD RRP incl. GST</font>',
                  H_PRICE),
        Spacer(1, 10),
        Paragraph('SKU: <font name="Courier">EV961722</font>', BODY),
        Spacer(1, 16),
        Paragraph('FILTRATION PERFORMANCE', H_SECTION),
        Paragraph('• Chlorine — Reduced', BODY),
        Paragraph('• Taste &amp; Odour — Improved', BODY),
        Paragraph('• Sediment — Down to 5 microns', BODY),
        Paragraph('• Lifespan — ~12 months / 2,000L', BODY),
        Spacer(1, 14),
        Paragraph('COMPATIBLE SYSTEMS', H_SECTION),
        Paragraph('• Peppy Taps Signature 5 in 1', BODY),
        Paragraph('• Peppy Taps Signature 4 in 1', BODY),
        Paragraph('• Peppy Taps Signature Pull Out 4 in 1', BODY),
        Paragraph('• Peppy Taps Flagship 4 in 1', BODY),
        Paragraph('• Peppy Taps Flagship Pull Out 4 in 1', BODY),
    ]

    filter_layout = Table(
        [[filter_img, filter_cell]],
        colWidths=[70 * mm, 95 * mm]
    )
    filter_layout.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (1, 0), (1, 0), 14),
    ]))
    story.append(filter_layout)
    story.append(PageBreak())

    # ------------------------------------------------------------
    # FINISHES PAGE
    # ------------------------------------------------------------
    story.append(Paragraph('CURATED TO COMPLEMENT', H_EYEBROW))
    story.append(Paragraph('Five Premium Finishes', H_TITLE_C))
    story.append(Spacer(1, 14))
    story.append(Paragraph(
        'Every Peppy Tap is available in five premium finishes — included in '
        'the Chrome base price for Signature, with finish-specific pricing '
        'across the range.',
        LEAD_C,
    ))
    story.append(Spacer(1, 20))

    finish_data = [[
        Paragraph('<b>Finish</b>', LABEL),
        Paragraph('<b>Character</b>', LABEL),
    ]]
    for name, desc in FINISH_DESCRIPTIONS:
        finish_data.append([
            Paragraph(f'<b>{name}</b>', BODY),
            Paragraph(desc, BODY),
        ])
    finish_table = Table(finish_data, colWidths=[55 * mm, 110 * mm])
    finish_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_DARK),
        ('TEXTCOLOR',  (0, 0), (-1, 0), white),
        ('FONTNAME',   (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE',   (0, 0), (-1, 0), 9),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 1), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 12),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, BRAND_BG]),
        ('LINEBELOW', (0, 0), (-1, -1), 0.25, BRAND_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(finish_table)
    story.append(PageBreak())

    # ------------------------------------------------------------
    # COMPARISON TABLE
    # ------------------------------------------------------------
    story.append(Paragraph('COMPARE', H_EYEBROW))
    story.append(Paragraph('Find Your Perfect Configuration', H_TITLE_C))
    story.append(Spacer(1, 14))
    story.append(Paragraph(
        'A side-by-side look at every Peppy Taps system. All Signature '
        'systems include touch-control panel and seven boiling temperatures.',
        LEAD_C,
    ))
    story.append(Spacer(1, 18))

    cmp_header = [
        '', 'Sig 5-in-1', 'Sig 4-in-1', 'Sig Pull Out', 'Flag 4-in-1', 'Flag Pull Out',
    ]
    cmp_rows = [
        ['Filtered Boiling',     '✓ 75°-98°C', '✓ 75°-98°C', '✓ 75°-98°C', '✓ 98°C',     '✓ 98°C'],
        ['Filtered Chilled',     '✓',          '—',          '—',          '—',          '—'],
        ['Filtered Ambient',     '—',          '✓',          '✓',          '✓ option',   '✓ option'],
        ['Chilled Soda',         '✓',          '—',          '—',          '—',          '—'],
        ['Hot & Cold Mains',     '✓',          '✓',          '✓',          '✓',          '✓'],
        ['Touch-Control Panel',  '✓',          '✓',          '✓',          '—',          '—'],
        ['Pull-Out Hose',        '—',          '—',          '✓',          '—',          '✓'],
        ['Temperature Settings', '7 (75-98°C)', '7 (75-98°C)', '7 (75-98°C)', 'Fixed 98°C', 'Fixed 98°C'],
        ['From Price',           '$4,999',     '$2,999',     '$3,499',     '$2,499',     '$2,999'],
    ]

    cmp_data = [
        [Paragraph(f'<b>{c}</b>', LABEL) if i > 0 else Paragraph('', LABEL)
         for i, c in enumerate(cmp_header)]
    ]
    for row in cmp_rows:
        cmp_data.append([
            Paragraph(f'<b>{row[0]}</b>', BODY),
            *[Paragraph(c, BODY_C) for c in row[1:]]
        ])

    cmp_table = Table(cmp_data,
        colWidths=[40 * mm, 25 * mm, 25 * mm, 28 * mm, 25 * mm, 22 * mm])
    cmp_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_DARK),
        ('TEXTCOLOR',  (1, 0), (-1, 0), white),
        ('FONTSIZE',   (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, BRAND_BG]),
        ('LINEBELOW', (0, 0), (-1, -1), 0.25, BRAND_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        # Highlight the popular column (Sig 5-in-1)
        ('BACKGROUND', (1, 1), (1, -1), HexColor('#f0e2c5')),
    ]))
    story.append(cmp_table)
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        '<i>Highlighted column = most popular configuration. '
        'All prices in AUD, RRP including GST. Add finish premium for '
        'non-Chrome variants.</i>',
        CAPTION
    ))
    story.append(PageBreak())

    # ------------------------------------------------------------
    # WHERE TO BUY
    # ------------------------------------------------------------
    story.append(Paragraph('WHERE TO BUY', H_EYEBROW))
    story.append(Paragraph('Find a Retailer Near You', H_TITLE_C))
    story.append(Spacer(1, 14))
    story.append(Paragraph(
        'Peppy Taps is available through trusted Australian retailers and '
        'trade suppliers. Visit a showroom to experience the touch-control '
        'panel firsthand, or talk to your plumber about specifying Peppy '
        'Taps in your project.',
        LEAD_C,
    ))
    story.append(Spacer(1, 24))

    retailers = [
        ('Harvey Norman', '14 locations Australia-wide', 'Authorised Retailer'),
        ('Tradelink',     '14 locations Australia-wide', 'Trade Supplier'),
        ('Reece',         '700+ locations Australia-wide', 'Authorised Retailer'),
    ]
    ret_data = [[
        Paragraph('<b>Retailer</b>', LABEL),
        Paragraph('<b>Network</b>', LABEL),
        Paragraph('<b>Type</b>', LABEL),
    ]]
    for name, locs, type_ in retailers:
        ret_data.append([
            Paragraph(f'<b>{name}</b>', BODY),
            Paragraph(locs, BODY),
            Paragraph(type_, BODY),
        ])
    ret_table = Table(ret_data, colWidths=[55 * mm, 65 * mm, 45 * mm])
    ret_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_DARK),
        ('TEXTCOLOR',  (0, 0), (-1, 0), white),
        ('FONTSIZE',   (0, 0), (-1, 0), 9),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 1), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 10),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, BRAND_BG]),
        ('LINEBELOW', (0, 0), (-1, -1), 0.25, BRAND_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(ret_table)
    story.append(divider(before=30, after=20))

    # Contact card
    contact_cell = [
        Paragraph('GET IN TOUCH', H_SECTION),
        Paragraph('Call: <b>03 9122 0716</b>', BODY),
        Paragraph('Email: <b>sales@peppytaps.com.au</b>', BODY),
        Paragraph('Hours: Mon–Fri 9:00am – 5:00pm AEST', BODY),
        Spacer(1, 8),
        Paragraph('<b>peppytaps.com.au</b>', BODY),
    ]
    trade_cell = [
        Paragraph('TRADE PARTNERS', H_SECTION),
        Paragraph(
            'Becoming a Peppy Taps retailer means competitive trade margins, '
            'full marketing support, dedicated account management, and '
            'product training. Email us to request a trade pack.',
            BODY,
        ),
    ]
    contact_table = Table(
        [[contact_cell, trade_cell]],
        colWidths=[82.5 * mm, 82.5 * mm]
    )
    contact_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 16),
        ('RIGHTPADDING', (0, 0), (-1, -1), 16),
        ('TOPPADDING', (0, 0), (-1, -1), 18),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 18),
        ('BACKGROUND', (0, 0), (-1, -1), white),
        ('LINEAFTER', (0, 0), (0, -1), 0.5, BRAND_BORDER),
    ]))
    story.append(contact_table)
    story.append(PageBreak())

    # ------------------------------------------------------------
    # BACK COVER
    # ------------------------------------------------------------
    story.append(Spacer(1, 40 * mm))
    story.append(Paragraph(
        '<font color="#1d3a5f"><b>One tap.<br/>Five functions.<br/>Endless ease.</b></font>',
        ParagraphStyle('Closer', parent=styles['Title'],
            fontName='Helvetica-Bold', fontSize=36, leading=44,
            textColor=BRAND_DARK, alignment=TA_CENTER, spaceAfter=24)
    ))
    story.append(Spacer(1, 60))
    story.append(Paragraph(
        '<b>peppytaps.com.au</b><br/>'
        '03 9122 0716 &nbsp;&nbsp;|&nbsp;&nbsp; sales@peppytaps.com.au',
        ParagraphStyle('Closer2', parent=BODY_C,
            fontSize=10, leading=18, textColor=BRAND_DARK)
    ))
    story.append(Spacer(1, 80))
    story.append(Paragraph(
        '<font size=7 color="#999999">© 2026 Peppy Taps. All rights reserved. '
        'Registered Design No: 202410381. Specifications and prices subject to '
        'change without notice. WaterMark certified. NSF 42 filtration.</font>',
        BODY_C
    ))

    doc.build(story)
    print(f'✓ Built {OUT}')


if __name__ == '__main__':
    build_brochure()
