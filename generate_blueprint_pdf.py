import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable, PageBreak
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        
        # Top Accent Gradient Line
        self.setStrokeColor(colors.HexColor("#4f46e5"))
        self.setLineWidth(3)
        self.line(40, 11 * inch - 25, 8.5 * inch - 40, 11 * inch - 25)
        
        # Running Header
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        self.drawString(40, 11 * inch - 18, "WAYPOINT RIT — 3D SMART CAMPUS NAVIGATION & SPATIAL GIS BLUEPRINT")

        # Footer Accent Line
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(1)
        self.line(40, 42, 8.5 * inch - 40, 42)

        # Footer Content
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        self.drawString(40, 26, "RIT Innovation Showcase • Official Project Blueprint")
        self.drawRightString(8.5 * inch - 40, 26, f"Page {self._pageNumber} of {page_count}")
        
        self.restoreState()

def build_pdf():
    os.makedirs("exports", exist_ok=True)
    pdf_path = os.path.join("exports", "Waypoint_RIT_Project_Blueprint.pdf")
    
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=45,
        bottomMargin=48
    )

    styles = getSampleStyleSheet()

    # Custom Color Palette
    PRIMARY = colors.HexColor("#4f46e5")
    PRIMARY_DARK = colors.HexColor("#1e1b4b")
    SECONDARY = colors.HexColor("#0284c7")
    TEXT_MAIN = colors.HexColor("#0f172a")
    TEXT_MUTED = colors.HexColor("#475569")
    BG_LIGHT = colors.HexColor("#f8fafc")
    BORDER_LIGHT = colors.HexColor("#e2e8f0")

    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        textColor=PRIMARY_DARK,
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        "DocSubTitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=12,
        leading=16,
        textColor=SECONDARY,
        spaceAfter=18
    )

    h1_style = ParagraphStyle(
        "Heading1",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=19,
        textColor=PRIMARY_DARK,
        spaceBefore=14,
        spaceAfter=8
    )

    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14.5,
        textColor=TEXT_MAIN,
        spaceAfter=8
    )

    bullet_style = ParagraphStyle(
        "Bullet",
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=5
    )

    table_header_style = ParagraphStyle(
        "THead",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=12,
        textColor=colors.white
    )

    table_cell_style = ParagraphStyle(
        "TCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12.5,
        textColor=TEXT_MAIN
    )

    table_cell_bold = ParagraphStyle(
        "TCellBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12.5,
        textColor=PRIMARY_DARK
    )

    story = []

    # -------------------------------------------------------------
    # HEADER BANNER & PROJECT TITLE
    # -------------------------------------------------------------
    story.append(Paragraph("Waypoint RIT — 3D Smart Campus Blueprint", title_style))
    story.append(Paragraph("Next-Generation Interactive 3D Spatial Navigation & Indoor GIS Ecosystem", subtitle_style))

    # Meta Info Table Card
    meta_data = [
        [
            Paragraph("<b>Project Title:</b> Waypoint RIT Campus GIS", table_cell_style),
            Paragraph("<b>Event Category:</b> Innovation Showcase / Smart Campus", table_cell_style)
        ],
        [
            Paragraph("<b>Technology Stack:</b> FastAPI, Mapbox GL JS WebGL, MySQL, GeoJSON", table_cell_style),
            Paragraph("<b>Status:</b> Fully Integrated Multi-Platform Release", table_cell_style)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[3.6 * inch, 3.6 * inch])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_LIGHT),
        ('BOX', (0,0), (-1,-1), 1, BORDER_LIGHT),
        ('PADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 14))

    # -------------------------------------------------------------
    # SECTION 1: EXECUTIVE SUMMARY & PROJECT VISION
    # -------------------------------------------------------------
    story.append(Paragraph("1. Executive Summary & Project Vision", h1_style))
    story.append(Paragraph(
        "Traditional campus maps are static 2D images that fail to communicate complex multi-story building layouts, room locations, or true indoor spatial awareness. <b>Waypoint RIT</b> solves this challenge by introducing a state-of-the-art <b>3D Interactive GIS System</b> designed specifically for large academic institutions.",
        body_style
    ))
    story.append(Paragraph(
        "By synthesizing real-time GPS localization, high-precision architectural room buffering, and WebGL 3D extruded rendering, Waypoint RIT empowers students, faculty, visitors, and event attendees to explore campus buildings, isolate specific floor cutaways, and navigate turn-by-turn both outdoors and indoors.",
        body_style
    ))

    # Key Architectural Pillars Box
    pillars_data = [
        [
            Paragraph("<b>Architectural X-Ray Inspection</b>", table_header_style),
            Paragraph("<b>Robust Data Resiliency</b>", table_header_style),
            Paragraph("<b>Unified Ecosystem</b>", table_header_style)
        ],
        [
            Paragraph("Interactive 3D building shells slice dynamically by floor, revealing 0.38m thick solid walls and 3D room tags.", table_cell_style),
            Paragraph("Auto-switching local/cloud APIs paired with zero-crash database fallback ensure flawless event demos.", table_cell_style),
            Paragraph("Synchronized desktop kiosk, interactive admin dashboard, and touch-first mobile interfaces.", table_cell_style)
        ]
    ]
    pillars_table = Table(pillars_data, colWidths=[2.4 * inch, 2.4 * inch, 2.4 * inch])
    pillars_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('BACKGROUND', (0,1), (-1,1), BG_LIGHT),
        ('BOX', (0,0), (-1,-1), 1, PRIMARY),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_LIGHT),
        ('PADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(Spacer(1, 4))
    story.append(pillars_table)
    story.append(Spacer(1, 14))

    # -------------------------------------------------------------
    # SECTION 2: 3D ARCHITECTURAL GIS & RENDERING ENGINE
    # -------------------------------------------------------------
    story.append(Paragraph("2. 3D Architectural GIS & Rendering Engine", h1_style))
    story.append(Paragraph(
        "Waypoint RIT employs Mapbox GL JS coupled with custom client-side GeoJSON computational geometry to construct a fully volumetric digital twin of the RIT campus:",
        body_style
    ))

    story.append(Paragraph("• <b>Extruded Building Shells (`building-shells`):</b> Renders 3D building blocks with dynamic hover styling and automatic X-Ray cutaway filtering upon user selection.", bullet_style))
    story.append(Paragraph("• <b>Elevated Floor Plates (`indoor-floor-plate`):</b> Dynamically positions floor slab polygons at precise `elevation = level * 4.0m` heights.", bullet_style))
    story.append(Paragraph("• <b>0.38m Thick Solid Architectural Walls (`indoor-walls`):</b> Generates real-world 38cm perimeter wall buffers around every room footprint, extruded to 2.6m floor-to-ceiling height to prevent sub-pixel WebGL clipping.", bullet_style))
    story.append(Paragraph("• <b>Mercator 3D Projected Labels (`roomMarkersList`):</b> Uses high-precision `transform.projMatrix` calculations to lock HTML room tags directly over elevated 3D room centers.", bullet_style))

    story.append(Spacer(1, 10))

    # -------------------------------------------------------------
    # SECTION 3: MULTI-PLATFORM FRONTEND INTERFACES
    # -------------------------------------------------------------
    story.append(Paragraph("3. Unified Multi-Platform Frontend Ecosystem", h1_style))
    story.append(Paragraph(
        "To cater to diverse campus use cases—from interactive campus kiosks to on-the-go smartphone navigation—Waypoint RIT provides three tailored interfaces:",
        body_style
    ))

    fe_data = [
        [
            Paragraph("Interface Layer", table_header_style),
            Paragraph("Target Port", table_header_style),
            Paragraph("Core Functionality & UX Specialization", table_header_style)
        ],
        [
            Paragraph("<b>Main Kiosk (`frontend`)</b>", table_cell_bold),
            Paragraph("Port 8080", table_cell_style),
            Paragraph("Public-facing 3D campus explorer with interactive info panel, floor selector widget, and high-visibility indoor turn-by-turn routing.", table_cell_style)
        ],
        [
            Paragraph("<b>Interactive New / Admin (`frontend_new`)</b>", table_cell_bold),
            Paragraph("Port 8082", table_cell_style),
            Paragraph("Advanced responsive desktop/kiosk interface with full room directory search, live campus announcements, and X-Ray floor slicing.", table_cell_style)
        ],
        [
            Paragraph("<b>Mobile Explorer (`frontend_mobile`)</b>", table_cell_bold),
            Paragraph("Port 8081", table_cell_style),
            Paragraph("Touch-optimized mobile web app featuring spring-animated bottom sheets, GPS Locate-Me tracking, and instant room selection.", table_cell_style)
        ]
    ]
    fe_table = Table(fe_data, colWidths=[1.8 * inch, 0.9 * inch, 4.5 * inch])
    fe_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY_DARK),
        ('BACKGROUND', (0,1), (-1,-1), colors.white),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('BOX', (0,0), (-1,-1), 1, BORDER_LIGHT),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_LIGHT),
        ('PADDING', (0,0), (-1,-1), 7),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(fe_table)
    story.append(Spacer(1, 14))

    # -------------------------------------------------------------
    # SECTION 4: BACKEND & DATA RESILIENCY ARCHITECTURE
    # -------------------------------------------------------------
    story.append(Paragraph("4. Backend API & Zero-Crash Resiliency Architecture", h1_style))
    story.append(Paragraph(
        "The server-side engine is built on <b>FastAPI (Python)</b> serving structured JSON and GeoJSON geometry endpoints (`/admin/buildings`, `/admin/rooms`, `/live-data`, `/search/{query}`).",
        body_style
    ))
    story.append(Paragraph(
        "<b>Zero-Crash Event Fallback Mechanism:</b> For high-stakes presentations and technical showcases, the API layer incorporates automated fallback interception. If local MySQL connectivity is interrupted or unavailable, the backend immediately transitions to in-memory campus geometry polygons, guaranteeing 100% uptime without manual intervention.",
        body_style
    ))
    story.append(Paragraph(
        "<b>Dynamic Host Resolution Engine:</b> All frontends auto-detect their network origin (`isLocal`), routing seamlessly to `127.0.0.1:8000` during local showcase execution and `waypoint-rit.onrender.com` in production deployment.",
        body_style
    ))

    story.append(Spacer(1, 10))

    # -------------------------------------------------------------
    # SECTION 5: SHOWCASE DEMONSTRATION WORKFLOW
    # -------------------------------------------------------------
    story.append(Paragraph("5. Event Showcase Demonstration Workflow", h1_style))
    
    demo_data = [
        [
            Paragraph("Step #", table_header_style),
            Paragraph("Demonstration Action", table_header_style),
            Paragraph("Observed System Behavior & Innovation Highlight", table_header_style)
        ],
        [
            Paragraph("<b>01</b>", table_cell_bold),
            Paragraph("Campus Overview Fly-In", table_cell_style),
            Paragraph("WebGL camera glides smoothly to RIT Campus center at 60° isometric pitch with 3D atmospheric lighting.", table_cell_style)
        ],
        [
            Paragraph("<b>02</b>", table_cell_bold),
            Paragraph("Building X-Ray Selection", table_cell_style),
            Paragraph("Clicking any academic block (e.g., C Block) hides the outer shell and reveals elevated floors and room cards.", table_cell_style)
        ],
        [
            Paragraph("<b>03</b>", table_cell_bold),
            Paragraph("Floor-by-Floor Slicing", table_cell_style),
            Paragraph("Tapping 'Floor 7' elevates 38cm solid architectural walls and projects WebGL room tags locked over classrooms.", table_cell_style)
        ],
        [
            Paragraph("<b>04</b>", table_cell_bold),
            Paragraph("Clean Dismiss / Reset", table_cell_style),
            Paragraph("Unified `deselectBuilding()` restores full campus shells and returns camera to global campus view instantly.", table_cell_style)
        ]
    ]
    demo_table = Table(demo_data, colWidths=[0.7 * inch, 2.0 * inch, 4.5 * inch])
    demo_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), SECONDARY),
        ('BACKGROUND', (0,1), (-1,-1), colors.white),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('BOX', (0,0), (-1,-1), 1, BORDER_LIGHT),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_LIGHT),
        ('PADDING', (0,0), (-1,-1), 7),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(demo_table)

    # Build PDF
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated PDF blueprint: {pdf_path}")

if __name__ == "__main__":
    build_pdf()
