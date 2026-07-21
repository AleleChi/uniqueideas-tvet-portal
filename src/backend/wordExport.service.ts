import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  ImageRun, 
  AlignmentType, 
  WidthType, 
  BorderStyle,
  Footer,
  PageNumber
} from "docx";
import axios from "axios";
import crypto from "crypto";

// Helper to fetch images dynamically via axios
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const response = await axios.get(url, { responseType: "arraybuffer", timeout: 5000 });
    return Buffer.from(response.data);
  } catch (err) {
    console.error(`[fetchImageBuffer] Failed to fetch image from ${url}:`, err);
    return null;
  }
}

interface PhotoAlbumMetadata {
  documentId: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  checksum: string;
  rosterId: string;
  tspId: string;
  rosterVersion: number;
  selectedMemberCount: number;
  generatedBy: string;
  generatedAt: string;
  templateVersion: string;
  status: string;
}

export class WordExportService {
  /**
   * Generates a fully compliant, beautiful Microsoft Word (.docx) file for the Official Photo Album.
   * Leverages the docx library to construct a proper OOXML ZIP package with binary image embedding.
   */
  static async generatePhotoAlbumDocx(
    sliced: any[], 
    settings: any, 
    metaContext: {
      generatedBy: string;
      rosterId: string;
      tspId: string;
      rosterVersion: number;
    }
  ): Promise<{ buffer: Buffer; metadata: PhotoAlbumMetadata }> {
    // 1. Fetch header images/logos if available
    let headerBuffer: Buffer | null = null;
    let fmeBuffer: Buffer | null = null;
    let ideasBuffer: Buffer | null = null;
    let wbBuffer: Buffer | null = null;

    if (settings && settings.photoAlbumHeaderUrl) {
      headerBuffer = await fetchImageBuffer(settings.photoAlbumHeaderUrl);
    } else {
      if (settings?.fmeLogoUrl) {
        fmeBuffer = await fetchImageBuffer(settings.fmeLogoUrl);
      }
      if (settings?.ideasLogoUrl) {
        ideasBuffer = await fetchImageBuffer(settings.ideasLogoUrl);
      }
      if (settings?.worldBankLogoUrl) {
        wbBuffer = await fetchImageBuffer(settings.worldBankLogoUrl);
      }
    }

    // 2. Prepare header paragraphs/elements
    const bodyChildren: any[] = [];

    // Header Table
    if (headerBuffer) {
      bodyChildren.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new ImageRun({
                          data: headerBuffer,
                          transformation: {
                            width: 600,
                            height: 80,
                          },
                        } as any),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
      );
    } else {
      // 3 logo columns
      const cells: TableCell[] = [];
      
      // Column 1: FME
      cells.push(
        new TableCell({
          width: { size: 33, type: WidthType.PERCENTAGE },
          children: [
            fmeBuffer 
              ? new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: [
                    new ImageRun({
                      data: fmeBuffer,
                      transformation: { width: 65, height: 65 },
                    } as any),
                  ],
                })
              : new Paragraph({
                  children: [
                    new TextRun({ text: "FEDERAL EDUCATION", bold: true, size: 20, color: "475569" }),
                  ],
                }),
          ],
        })
      );

      // Column 2: IDEAS
      cells.push(
        new TableCell({
          width: { size: 34, type: WidthType.PERCENTAGE },
          children: [
            ideasBuffer 
              ? new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new ImageRun({
                      data: ideasBuffer,
                      transformation: { width: 75, height: 65 },
                    } as any),
                  ],
                })
              : new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({ text: "IDEAS-TVET INITIATIVE", bold: true, size: 24, color: "1E1B4B" }),
                  ],
                }),
          ],
        })
      );

      // Column 3: World Bank
      cells.push(
        new TableCell({
          width: { size: 33, type: WidthType.PERCENTAGE },
          children: [
            wbBuffer 
              ? new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new ImageRun({
                      data: wbBuffer,
                      transformation: { width: 65, height: 65 },
                    } as any),
                  ],
                })
              : new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({ text: "WORLD BANK", bold: true, size: 20, color: "475569" }),
                  ],
                }),
          ],
        })
      );

      bodyChildren.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE },
          },
          rows: [
            new TableRow({
              children: cells,
            }),
          ],
        })
      );
    }

    // Spacer
    bodyChildren.push(new Paragraph({ spacing: { before: 200 } }));

    // Title Block
    bodyChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "Official Beneficiary Photo Album Registry",
            bold: true,
            size: 32, // 16pt
            color: "0F172A",
          }),
        ],
      })
    );
    bodyChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "Federally Authenticated TVET Trainees Profile Dashboard Directory [Range Subset]",
            size: 20, // 10pt
            color: "475569",
          }),
        ],
        spacing: { after: 300 },
      })
    );

    // Intro Paragraph
    bodyChildren.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({
            text: "This is to certify that the dynamic biometrics registration lock is active across our federal skill hubs. The candidates cataloged below are verified by our accredited audit workflows as enrolled participants for Computer Hardware and Cell Phone Repairs. Export Subset: Trainees S/N 1 to " + sliced.length + " (Total: " + sliced.length + ")",
            size: 20, // 10pt
            color: "334155",
          }),
        ],
        spacing: { after: 300 },
      })
    );

    // Main Table Rows
    const mainTableRows: TableRow[] = [
      // Table Header Row
      new TableRow({
        children: [
          new TableCell({
            width: { size: 8, type: WidthType.PERCENTAGE },
            shading: { fill: "000000" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: "S/N", bold: true, color: "FFFFFF", size: 21 })],
              }),
            ],
            margins: { top: 150, bottom: 150, left: 100, right: 100 },
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { fill: "000000" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: "PHOTOGRAPH", bold: true, color: "FFFFFF", size: 21 })],
              }),
            ],
            margins: { top: 150, bottom: 150, left: 100, right: 100 },
          }),
          new TableCell({
            width: { size: 67, type: WidthType.PERCENTAGE },
            shading: { fill: "000000" },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [new TextRun({ text: "DETAILS", bold: true, color: "FFFFFF", size: 21 })],
              }),
            ],
            margins: { top: 150, bottom: 150, left: 150, right: 150 },
          }),
        ],
      }),
    ];

    // Build Rows for Trainees
    for (let i = 0; i < sliced.length; i++) {
      const b = sliced[i];
      const index = i + 1;
      const lga = b.customFields?.["Local Government Area (LGA)"] || b.customFields?.["lga"] || b.customFields?.["LGA"] || b.customFields?.["cf_lga"] || "N/A";
      const age = b.customFields?.["Age"] || b.customFields?.["age"] || b.customFields?.["Date of Birth"] || b.customFields?.["dob"] || "N/A";

      // Decode and resize photo if exists
      let photoBuffer: Buffer | null = null;
      if (b.photo) {
        try {
          let cleanBase64 = b.photo;
          const match = b.photo.match(/^(data:(image\/[a-zA-Z1-9+-]+);base64,)/);
          if (match) {
            cleanBase64 = b.photo.substring(match[1].length);
          }
          photoBuffer = Buffer.from(cleanBase64, "base64");
        } catch (photoErr) {
          console.error(`[Photo Dec] Failed to parse photo buffer for candidate ${b.id}:`, photoErr);
        }
      }

      // Build Details Nested Table
      const detailsNestedTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          insideHorizontal: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE },
        },
        rows: [
          // Section A Header Row
          new TableRow({
            children: [
              new TableCell({
                columnSpan: 2,
                shading: { fill: "000000" },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "SECTION A: TRAINEE INFORMATION",
                        bold: true,
                        color: "FFFFFF",
                        size: 17, // 8.5pt
                      }),
                    ],
                  }),
                ],
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
              }),
            ],
          }),
          // Row 1: Full Name
          new TableRow({
            children: [
              new TableCell({
                width: { size: 40, type: WidthType.PERCENTAGE },
                borders: { bottom: { style: BorderStyle.DASHED, size: 4, color: "CCCCCC" } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Full Name (Surname First):", bold: true, color: "475569", size: 18 }),
                    ],
                  }),
                ],
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
              }),
              new TableCell({
                width: { size: 60, type: WidthType.PERCENTAGE },
                borders: { bottom: { style: BorderStyle.DASHED, size: 4, color: "CCCCCC" } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `${(b.lastName || "").toUpperCase()}, ${(b.firstName || "").toUpperCase()} ${b.otherName ? (b.otherName || "").toUpperCase() : ""}`,
                        bold: true,
                        color: "000000",
                        size: 18,
                      }),
                    ],
                  }),
                ],
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
              }),
            ],
          }),
          // Row 2: Skill Applied For
          new TableRow({
            children: [
              new TableCell({
                width: { size: 40, type: WidthType.PERCENTAGE },
                borders: { bottom: { style: BorderStyle.DASHED, size: 4, color: "CCCCCC" } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Skill Applied For:", bold: true, color: "475569", size: 18 }),
                    ],
                  }),
                ],
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
              }),
              new TableCell({
                width: { size: 60, type: WidthType.PERCENTAGE },
                borders: { bottom: { style: BorderStyle.DASHED, size: 4, color: "CCCCCC" } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: (b.skillSector || "Computer Hardware and Cell Phone Repairs").toUpperCase(),
                        bold: true,
                        color: "000000",
                        size: 18,
                      }),
                    ],
                  }),
                ],
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
              }),
            ],
          }),
          // Row 3: Gender
          new TableRow({
            children: [
              new TableCell({
                width: { size: 40, type: WidthType.PERCENTAGE },
                borders: { bottom: { style: BorderStyle.DASHED, size: 4, color: "CCCCCC" } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Gender:", bold: true, color: "475569", size: 18 }),
                    ],
                  }),
                ],
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
              }),
              new TableCell({
                width: { size: 60, type: WidthType.PERCENTAGE },
                borders: { bottom: { style: BorderStyle.DASHED, size: 4, color: "CCCCCC" } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: (b.gender || "N/A").toUpperCase(),
                        bold: true,
                        color: "000000",
                        size: 18,
                      }),
                    ],
                  }),
                ],
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
              }),
            ],
          }),
          // Row 4: Age
          new TableRow({
            children: [
              new TableCell({
                width: { size: 40, type: WidthType.PERCENTAGE },
                borders: { bottom: { style: BorderStyle.DASHED, size: 4, color: "CCCCCC" } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Age / Date of Birth:", bold: true, color: "475569", size: 18 }),
                    ],
                  }),
                ],
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
              }),
              new TableCell({
                width: { size: 60, type: WidthType.PERCENTAGE },
                borders: { bottom: { style: BorderStyle.DASHED, size: 4, color: "CCCCCC" } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: String(b.dateOfBirth || age),
                        bold: true,
                        color: "000000",
                        size: 18,
                      }),
                    ],
                  }),
                ],
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
              }),
            ],
          }),
          // Row 5: NIN
          new TableRow({
            children: [
              new TableCell({
                width: { size: 40, type: WidthType.PERCENTAGE },
                borders: { bottom: { style: BorderStyle.DASHED, size: 4, color: "CCCCCC" } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "NIN:", bold: true, color: "475569", size: 18 }),
                    ],
                  }),
                ],
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
              }),
              new TableCell({
                width: { size: 60, type: WidthType.PERCENTAGE },
                borders: { bottom: { style: BorderStyle.DASHED, size: 4, color: "CCCCCC" } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: String(b.nin || "N/A"),
                        bold: true,
                        color: "000000",
                        size: 18,
                      }),
                    ],
                  }),
                ],
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
              }),
            ],
          }),
          // Section B Header Row
          new TableRow({
            children: [
              new TableCell({
                columnSpan: 2,
                shading: { fill: "000000" },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "SECTION B: CONTACT & LOCATION DETS",
                        bold: true,
                        color: "FFFFFF",
                        size: 17,
                      }),
                    ],
                  }),
                ],
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
              }),
            ],
          }),
          // Row 6: Phone Number
          new TableRow({
            children: [
              new TableCell({
                width: { size: 40, type: WidthType.PERCENTAGE },
                borders: { bottom: { style: BorderStyle.DASHED, size: 4, color: "CCCCCC" } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Phone Number:", bold: true, color: "475569", size: 18 }),
                    ],
                  }),
                ],
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
              }),
              new TableCell({
                width: { size: 60, type: WidthType.PERCENTAGE },
                borders: { bottom: { style: BorderStyle.DASHED, size: 4, color: "CCCCCC" } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: String(b.phoneNumber || "N/A"),
                        bold: true,
                        color: "000000",
                        size: 18,
                      }),
                    ],
                  }),
                ],
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
              }),
            ],
          }),
          // Row 7: Email
          new TableRow({
            children: [
              new TableCell({
                width: { size: 40, type: WidthType.PERCENTAGE },
                borders: { bottom: { style: BorderStyle.DASHED, size: 4, color: "CCCCCC" } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Email Address:", bold: true, color: "475569", size: 18 }),
                    ],
                  }),
                ],
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
              }),
              new TableCell({
                width: { size: 60, type: WidthType.PERCENTAGE },
                borders: { bottom: { style: BorderStyle.DASHED, size: 4, color: "CCCCCC" } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: String(b.email || "N/A"),
                        bold: true,
                        color: "000000",
                        size: 18,
                      }),
                    ],
                  }),
                ],
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
              }),
            ],
          }),
          // Row 8: State of Origin
          new TableRow({
            children: [
              new TableCell({
                width: { size: 40, type: WidthType.PERCENTAGE },
                borders: { bottom: { style: BorderStyle.DASHED, size: 4, color: "CCCCCC" } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "State of Origin:", bold: true, color: "475569", size: 18 }),
                    ],
                  }),
                ],
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
              }),
              new TableCell({
                width: { size: 60, type: WidthType.PERCENTAGE },
                borders: { bottom: { style: BorderStyle.DASHED, size: 4, color: "CCCCCC" } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: String(b.state || "N/A").toUpperCase(),
                        bold: true,
                        color: "000000",
                        size: 18,
                      }),
                    ],
                  }),
                ],
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
              }),
            ],
          }),
          // Row 9: LGA
          new TableRow({
            children: [
              new TableCell({
                width: { size: 40, type: WidthType.PERCENTAGE },
                borders: { bottom: { style: BorderStyle.DASHED, size: 4, color: "CCCCCC" } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "LGA of Origin:", bold: true, color: "475569", size: 18 }),
                    ],
                  }),
                ],
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
              }),
              new TableCell({
                width: { size: 60, type: WidthType.PERCENTAGE },
                borders: { bottom: { style: BorderStyle.DASHED, size: 4, color: "CCCCCC" } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: String(lga).toUpperCase(),
                        bold: true,
                        color: "000000",
                        size: 18,
                      }),
                    ],
                  }),
                ],
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
              }),
            ],
          }),
          // Row 10: Physical Hub
          new TableRow({
            children: [
              new TableCell({
                width: { size: 40, type: WidthType.PERCENTAGE },
                borders: { bottom: { style: BorderStyle.DASHED, size: 4, color: "CCCCCC" } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Physical Hub / Center:", bold: true, color: "475569", size: 18 }),
                    ],
                  }),
                ],
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
              }),
              new TableCell({
                width: { size: 60, type: WidthType.PERCENTAGE },
                borders: { bottom: { style: BorderStyle.DASHED, size: 4, color: "CCCCCC" } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: String(b.tsp || "N/A").toUpperCase(),
                        bold: true,
                        color: "000000",
                        size: 18,
                      }),
                    ],
                  }),
                ],
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
              }),
            ],
          }),
        ],
      });

      // Left Photo Column content paragraphs
      const photoParagraphs: Paragraph[] = [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "PHOTOGRAPH",
              bold: true,
              size: 17, // 8.5pt
              color: "1E1B4B",
            }),
          ],
          spacing: { after: 120 },
        }),
      ];

      if (photoBuffer) {
        photoParagraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: photoBuffer,
                transformation: {
                  width: 100,
                  height: 120,
                },
              } as any),
            ],
            spacing: { after: 120 },
          })
        );
      } else {
        photoParagraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "NO PHOTO",
                bold: true,
                size: 17,
                color: "94A3B8",
              }),
            ],
            spacing: { before: 200, after: 200 },
          })
        );
      }

      photoParagraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: `REF: ${b.id}`,
              bold: true,
              size: 16, // 8pt
              color: "64748B",
            }),
          ],
        })
      );

      mainTableRows.push(
        new TableRow({
          children: [
            // S/N Cell
            new TableCell({
              width: { size: 8, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
                bottom: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
                left: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
                right: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: String(index),
                      bold: true,
                      size: 22,
                      color: "1E293B",
                    }),
                  ],
                }),
              ],
              margins: { top: 150, bottom: 150, left: 100, right: 100 },
            }),
            // Photo Cell
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
                bottom: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
                left: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
                right: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
              },
              children: photoParagraphs,
              margins: { top: 150, bottom: 150, left: 100, right: 100 },
            }),
            // Details Cell
            new TableCell({
              width: { size: 67, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
                bottom: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
                left: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
                right: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
              },
              children: [detailsNestedTable],
              margins: { top: 150, bottom: 150, left: 150, right: 150 },
            }),
          ],
        })
      );
    }

    // Add main table to section children
    bodyChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 24, color: "000000" },
          bottom: { style: BorderStyle.SINGLE, size: 24, color: "000000" },
          left: { style: BorderStyle.SINGLE, size: 24, color: "000000" },
          right: { style: BorderStyle.SINGLE, size: 24, color: "000000" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
          insideVertical: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
        },
        rows: mainTableRows,
      })
    );

    // Spacer before Sign-off
    bodyChildren.push(new Paragraph({ spacing: { before: 400 } }));

    // Signatures Table 1
    bodyChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          insideHorizontal: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 45, type: WidthType.PERCENTAGE },
                borders: { top: { style: BorderStyle.SINGLE, size: 12, color: "000000" } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Accredited Coordinator Sign-off\n", bold: true, size: 18 }),
                      new TextRun({ text: "Unique Technology Nig. Ltd Coordinator\n\n", size: 18 }),
                      new TextRun({ text: "Signature: ___________________\n\n", size: 18 }),
                      new TextRun({ text: "Date: ________________________", size: 18 }),
                    ],
                  }),
                ],
                margins: { top: 150 },
              }),
              new TableCell({
                width: { size: 10, type: WidthType.PERCENTAGE },
                children: [new Paragraph("")],
              }),
              new TableCell({
                width: { size: 45, type: WidthType.PERCENTAGE },
                borders: { top: { style: BorderStyle.SINGLE, size: 12, color: "000000" } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Federal Board Auditor Signature\n", bold: true, size: 18 }),
                      new TextRun({ text: "Federal Ministry of Education Officer\n\n", size: 18 }),
                      new TextRun({ text: "Signature: ___________________\n\n", size: 18 }),
                      new TextRun({ text: "Date: ________________________", size: 18 }),
                    ],
                  }),
                ],
                margins: { top: 150 },
              }),
            ],
          }),
        ],
      })
    );

    // Spacer
    bodyChildren.push(new Paragraph({ spacing: { before: 300 } }));

    // Signatures Table 2
    bodyChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          insideHorizontal: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 45, type: WidthType.PERCENTAGE },
                borders: { top: { style: BorderStyle.SINGLE, size: 12, color: "000000" } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Center Hub Manager Approval\n", bold: true, size: 18 }),
                      new TextRun({ text: "Center: ______________________\n\n", size: 18 }),
                      new TextRun({ text: "Signature: ___________________\n\n", size: 18 }),
                      new TextRun({ text: "Date: ________________________", size: 18 }),
                    ],
                  }),
                ],
                margins: { top: 150 },
              }),
              new TableCell({
                width: { size: 10, type: WidthType.PERCENTAGE },
                children: [new Paragraph("")],
              }),
              new TableCell({
                width: { size: 45, type: WidthType.PERCENTAGE },
                borders: { top: { style: BorderStyle.SINGLE, size: 12, color: "000000" } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Registrar Verification\n", bold: true, size: 18 }),
                      new TextRun({ text: "Verified By: __________________\n\n", size: 18 }),
                      new TextRun({ text: "Signature: ___________________\n\n", size: 18 }),
                      new TextRun({ text: "Date: ________________________", size: 18 }),
                    ],
                  }),
                ],
                margins: { top: 150 },
              }),
            ],
          }),
        ],
      })
    );

    // Footer Hash line
    bodyChildren.push(new Paragraph({ spacing: { before: 400 } }));
    bodyChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "Security Hash Key: 0x8FE0A1959C - Classified Gov Registry | Printed via IDEAS Portal Management System",
            size: 15, // 7.5pt
            color: "64748B",
          }),
        ],
      })
    );

    // Create Document Section
    const doc = new Document({
      sections: [
        {
          properties: {},
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({ text: "Page ", size: 16, color: "64748B" }),
                    new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "64748B" }),
                    new TextRun({ text: " of ", size: 16, color: "64748B" }),
                    new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "64748B" }),
                  ],
                }),
              ],
            }),
          },
          children: bodyChildren,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    // 4. Calculate metadata details
    const docId = `gdoc_album_${Date.now()}`;
    const filename = "ideas_tvet_beneficiaries_photo_album.docx";
    const mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const byteSize = buffer.length;
    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");

    const metadata: PhotoAlbumMetadata = {
      documentId: docId,
      filename,
      mimeType,
      byteSize,
      checksum,
      rosterId: metaContext.rosterId || "roster_default",
      tspId: metaContext.tspId || "tsp_default",
      rosterVersion: metaContext.rosterVersion || 1,
      selectedMemberCount: sliced.length,
      generatedBy: metaContext.generatedBy,
      generatedAt: new Date().toISOString(),
      templateVersion: "2.1.0",
      status: "VALID",
    };

    return { buffer, metadata };
  }
}
