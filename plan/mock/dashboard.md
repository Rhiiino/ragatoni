<!-- plan/mock/dashboard.md -->

# Dashboard

Spec for the Ragatoni dashboard mock. Front end uses dummy data. Backend rules below are the behavior that data stands in for. The interactive mock is `dashboard.html` in this folder.

## Header

The page background is a gradient.

The header is the logo file `ragatoni-logo.png`, centered. There is no text name beside it. The logo is the brand mark.

## Stage

One centered group holds the open panels. Opening a panel slides that panel in and shifts the group sideways to make room. The group, not a single panel, stays centered. Closing a panel plays that motion in reverse: the panel slides away and the group slides back into the space it left. This open and close motion applies to chunks, the create-chunks panel, query, and results. The preview panel slides open and closed on its own. Switching it between the chunks side and the results side does not move the other panels. When the preview sits beside the chunks panel and would run past the right edge, the panel group slides left until the preview fits. The logo stays centered. Closing that preview slides the group back.

The page itself does not scroll. The dashboard stays in the viewport. Lists scroll inside their panels.

Query, results, and the preview panel are the same width and the same height. That height is tall enough for the query form. Results and the PDF pages scroll inside the panel when the content is taller than the panel. Switching the preview’s tabs does not change the panel’s size.

| Panel | Where it sits | How it opens | How it closes |
|---|---|---|---|
| Documents | Center, until a side panel opens | Always present | Does not close |
| Chunks | Right of documents | Click a document row | X. Documents return to center |
| Create chunks | Right of documents, in the chunks slot | Chunk on a processed document | X, or Create chunks. The chunks panel and a preview opened from a chunk hide while it is open |
| Query | Below documents | Query on a ready document | X, or the document is no longer ready |
| Results | Right of query | A query is run | Closes with the query panel or the document |
| Preview | Right of results, or flush to the right of chunks | Click a result row, or any chunk row | X, or the context that opened it closes |

The query panel is horizontally centered under the documents panel. When the documents panel slides to make room for chunks, the query panel moves with it and stays centered under the documents panel. Results stay to the right of query. A preview opened from a result stays to the right of results. A preview opened from a chunk sits flush with the top of the chunks panel, just to its right. Moving between those places keeps the slide.

## Visual groups

Panels carry a tint so related ones read as a set. Documents and query stay different sets even though a line connects them.

- **Group A** is teal. It is the documents panel, the chunks panel, the create-chunks panel, and the preview panel while that panel sits beside the chunks.
- **Group B** is blue. It is the query panel, the results panel, and the preview panel while that panel sits beside the results.

The preview panel switches tint when it moves. Beside the chunks it is Group A. Beside the results it is Group B.

## Sorting

Column headers in the documents list, the chunks list, and the results list are buttons. Clicking a header sorts that list by that column. Clicking the same header again reverses the direction, ascending then descending. The active header shows the direction. The documents Action column and menu column are not sort headers. The chunks embedding column sorts by whether the chunk has an embedding.

## Documents

The documents panel is the home of the dashboard. Its header shows `document.png` beside the title, about the height of the title row. A count pill after the title shows how many documents are in the list. A gear sits in the header, to the left of upload. The gear is a toothed cog. It changes color on hover. Hovering the gear shows the tooltip `Settings`. Hovering the upload mark shows the tooltip `Upload`. The tooltips appear only while the pointer is over the icon.

The documents panel is only as tall as its list, up to the viewport. It does not stretch to fill the column. The gear does not open another page. The documents panel swaps its own content, and the rest of the dashboard stays where it is. While `loading.png` plays, and while settings is open, the panel keeps the width and height it had as the documents list. That held size is 680 by 690. `loading.png` stays centered in that panel. First the panel shows `loading.png` centered. The icon starts small, grows until it is largest at a quarter of a second, then shrinks back to that small size by half a second. The settings content appears when that half second ends. Settings holds two configurations. Embedding model is a select of the rows in the embedding model table (`name` and `provider`). PDF library is a select of PyMuPDF and PyPlumber. Each select is 32 pixels tall and sits 7 pixels under its header. Each header has an eye inside a circle immediately to its right. The eye is not a control. Hovering it shows that configuration's description, and the description is not printed on the page. The eye uses the ink color while the pointer is over it. Embedding model's description is `Used for every document when it is embedded.` PDF library's description is `Used for every document when the PDF is extracted.` Any configuration added to this page later uses that same eye and tooltip. Nothing about a configuration is written under its select. The choices are kept in `sessions.preferences` as `{ "embedding_model_id": <id>, "pdf_library": "pymupdf" | "pyplumber" }`. `pymupdf` is PyMuPDF and `pyplumber` is PyPlumber. Embedding uses that model for every document. Extraction uses that library for every document. **Save** sits in the settings header, still inside the documents panel. It writes both preferences, plays the same half-second grow and shrink, then the documents list is back.

Search sits at the top and filters the list as the user types. There is no submit step.

Upload accepts a PDF in either of two ways:

- Drag and drop onto the panel.
- `upload.png` in the documents header. The click still starts an upload. On hover the mark grows slightly and picks up a soft glow.

Columns:

| Column | Content |
|---|---|
| Name | File name. Edit renames this in place |
| Status | Document status, on its own, left-aligned |
| Size | File size |
| Upload date | When the file was uploaded |
| Action | Chunk or Query, or an empty cell |
| Menu | A 3-dot menu |

Status uses a different color for each state:

- `ready` is green (`#8fbf7a`).
- `chunked` is teal (`#5ec8c5`).
- `processing` is gold (`#e2b15a`). `loading.png` sits beside the word.
- `embedding` is orchid (`#d48ad4`). The same `loading.png` sits beside the word.
- `chunking` is orange (`#e08a5a`). A small spinner sits beside the word.
- `processed` is the waiting state. It uses the faint color of the column headers.

`loading.png` spins from its center beside `processing` and `embedding`. Both use one slow speed, one turn every 3 seconds, in a continuous loop.

The Action column sits between the upload date and the menu. A row shows one button, or nothing:

- **Chunk** when status is `processed`. Extraction is finished and the document is ready to be chunked. The button does not start chunking. It opens the create-chunks panel to the right of documents. The button is gold, distinct from Query.
- **Query** when status is `ready`. The document is chunked and embedded. The button opens the query panel under the documents panel. The button is blue, distinct from Chunk.

Chunk, Query, the gear, and the menu items change color on hover. The close buttons do the same. The upload mark grows instead of changing color, and its tooltip says Upload. The gear tooltip says Settings. Save on the settings page shifts lighter on hover. Each settings eye shows its description only while the pointer is over it.

Any other status leaves that cell empty. There is no placeholder.

The 3-dot menu contains:

- **Delete.** Removes the document.
- **Edit.** Inline rename of the name. No separate edit screen.

The menu opens above the panel, not inside the list’s clipping box. When the list is near the bottom of the viewport, the menu opens upward so the items stay on screen.

Clicking a row opens the chunk panel for that document. The documents panel slides left. The pair stays centered. That click also closes the create-chunks panel, because both panels use the same slot.

When the list has no documents, the panel shows: upload your first document.

### Dummy documents

| Name | Size | Upload date | Status | Chunks | Action |
|---|---|---|---|---|---|
| pantry-notes.pdf | 420 KB | 2026-11-01 | processing | none | Empty |
| soup-stock.pdf | 1.1 MB | 2026-11-03 | chunking | none yet | Empty while chunking is in progress |
| weeknight-sauce.pdf | 860 KB | 2026-11-05 | chunked | 4, none embedded | Empty |
| bread-schedule.pdf | 2.4 MB | 2026-11-08 | embedding | 6, some embedded | Empty |
| sunday-gravy.pdf | 3.0 MB | 2026-11-10 | ready | 8, all embedded | Query |

An empty list is a separate view, not one of these rows. It shows: upload your first document.

## Create chunks

Chunk on a `processed` document opens this panel in the chunks slot. It does not start chunking. If the chunks panel is open, it hides. A preview opened from a chunk hides with it. A preview opened from a result stays up.

The panel is Group A, the same width as the chunks panel. Its header shows `chunks.png` beside the title, the same size as the documents mark.

At the top, the document's total token count from the processed PDF is plain text, not a boxed field. The number is large and teal. The word `tokens` is smaller, gold, and uppercase. The rest of the line stays quiet. The dummy totals are 8,420 for `pantry-notes.pdf`, 4,180 for `pasta-water.pdf`, and 19,640 for `focaccia.pdf`. A newly uploaded file uses 6,200.

Two inputs match the query panel's fields:

| Input | Behavior |
|---|---|
| Tokens per chunk | How many tokens each chunk holds |
| Overlap | How much the next chunk overlaps the previous one |

Overlap has two metrics, tokens and percent. A small icon pair sits to the right of the Overlap label. A coin is tokens. A percent sign is percent. The selected icon is filled. Clicking the pair flips the metric. Percent computes the overlap as that percentage of the tokens-per-chunk value. Tokens uses the overlap number as tokens directly.

Under the inputs, a compact strip sits above Create chunks. It shows two large figures and nothing else: the chunk count, and the overlap as entered (a percent sign when that metric is on, otherwise the token count). The count walks the document tokens in windows of the chunk size, stepping forward by chunk size minus overlap. Overlap has to be smaller than the chunk size. Until it is, the chunk figure is a dash and its label says why (`set size` or `too large`).

**Create chunks** starts chunking. The button shifts to gold on hover. The document status becomes `chunking`, the status column updates, and this panel closes. The X closes the panel and does not start chunking.

## Chunks

The chunk panel lists that document's chunks. Its header shows `chunks.png` beside the title, the same size as the documents mark. A count pill after the title shows how many chunks that document has, in the same style as the documents count.

| Column | Content |
|---|---|
| Index | Chunk index |
| Token count | Tokens in the chunk |
| Preview | Truncated chunk text |
| Embedding | Header is Embedded. A checkmark inside a circle when this chunk has an embedding. Empty when it does not |

Clicking any chunk opens the preview panel for that chunk, flush with the top of the chunks panel and just to its right. The preview shows the pages that chunk spans, and the panel scrolls only those pages. The Embedding tab in that same panel shows the model and vector when the chunk has an embedding, and says there is no embedding when it does not.

The chunk panel X closes the chunk panel and a preview opened from a chunk, and slides the documents panel back to center.

### Dummy chunks for sunday-gravy.pdf

| Index | Tokens | Preview | Embedding |
|---|---|---|---|
| 0 | 180 | Sunday gravy starts with olive oil and a soffritto of onion, carrot, and celery. | yes |
| 1 | 240 | Brown the meat in batches so the pot stays hot, then return it to the sauce. | yes |
| 2 | 150 | Simmer uncovered until the sauce coats a spoon and the fat rises to the edge. | yes |

## Preview

The preview panel has two tabs, Preview and Embedding. The panel stays the same size on either tab, and it still slides open and closed.

Preview shows real pages from `common-sense.pdf` in this folder, drawn as page images. It does not add a text layer, a page editor, or a second copy of the chunk text. The pages are only the ones that chunk spans. When a chunk spans more than one page, those pages stack in the panel and the user scrolls between them. The same scroll applies whether the preview was opened from a chunk row or a result row.

Embedding shows the chunk’s model name and the stored vector, not a chart. A chunk with no embedding shows that there is none. Chunk 0 uses model `text-embedding-3-small` and vector `[0.012, -0.084, 0.331, 0.057, -0.119, …]`.

The panel has two jobs. From the chunks panel, it browses a chunk without a query. From a result row, it shows that hit.

A result click leaves the panel to the right of results and tints it Group B. A chunk click moves it flush with the chunks panel, just to the right, and tints it Group A. Clicking a result row again moves it back beside results and shows that row’s pages. Switching places plays as the panel moving. Documents, chunks, query, and results stay where they are while it moves. If the chunks-side preview would run past the right edge, that same group has already slid left together so the preview fits, and the logo stays centered.

While that move is in progress, the preview panel is blank. The tabs, the close button, the pages, the embedding, and any scrollbar are hidden. The panel keeps its usual surface. `single.png` is centered in it, 75% larger than the first mark, at 168 by 112 pixels. It fades in quickly as the move starts and fades out quickly as the move ends. When the panel is still, the normal content is back. The bowtie is not shown while the panel is still, and it does not appear for an open or a close.

The panel’s own X closes it. A preview opened from a result also closes when the query panel or the document context closes. A preview opened from a chunk stays up when the query closes, and closes when the chunks panel closes. Closing slides the panel back out.

## Query

Query is the Action button on a document whose status is `ready`. It opens a panel centered beneath the documents panel, and it stays centered beneath that panel when the documents panel moves. Its header shows `search.png` beside the title, the same size as the documents mark.

Controls:

| Control | Behavior |
|---|---|
| Search | The question to run against this document. The Search button stays disabled while this field is empty or only spaces, then it becomes clickable |
| Retrieval | `naive` is semantic search. `hybrid` is BM25 plus semantic search |
| Top-K | How many chunks to return |
| Score threshold | Drop hits below this score |
| X | Hides the query panel |

The panel also hides when the document is not `ready`.

Running a query opens the results panel to the right of the query panel.

### Dummy query

- Document: `sunday-gravy.pdf`
- Search: `How long does the sauce simmer?`
- Retrieval: `hybrid`
- Top-K: 5
- Score threshold: 0.20

## Results

Results are ranked rows for the open query. The panel is the same size as the query panel. A count pill after the title shows how many rows came back, in the same style as the documents count. The rows scroll inside the panel. The page does not grow to fit them.

Each row shows:

- Rank
- Truncated chunk text
- Score
- Chunk index, center-aligned with the Chunk header

The retrieval mode appears once, in the results header, as an italic serif pill. It reads `naive` or `hybrid`. The pill sits 15 pixels above the column headers. Rows do not repeat the mode.

`naive` puts one score in that column. `hybrid` keeps the same single Score column and stacks three values in it: the keyword BM25 score in gold, the dense score in teal, and the reciprocal rank fusion score in orchid. That column is 156 pixels wide for hybrid so the three values have room. Ranking and the score threshold use the RRF score.

Clicking a row grows the full chunk text downward from the bottom of that same row. The text stays inside the row. Clicking the row again plays that motion in reverse and folds the text away. The click also opens the PDF preview to the right of results, on the pages that chunk spans. If the preview was beside the chunks, it moves back to that spot.

Results close when the query panel closes or the document context closes. A preview opened from a result closes with them. A preview opened from a chunk stays up.

### Dummy results

The header pill says `hybrid`. The Score column on each row holds BM25, dense, and RRF together.

| Rank | Preview | Score | Chunk |
|---|---|---|---|
| 1 | Sunday gravy starts with olive oil and a soffritto of onion, carrot, and celery. | BM25 0.48, dense 0.90, RRF 0.93 | 0 |
| 2 | Brown the meat in batches so the pot stays hot, then return it to the sauce. | BM25 0.66, dense 0.78, RRF 0.82 | 1 |
| 3 | Simmer uncovered until the sauce coats a spoon and the fat rises to the edge. | BM25 0.84, dense 0.66, RRF 0.71 | 2 |

Those three numbers share one column. The chunk index is centered under Chunk.

Expanded text for rank 1 is the full chunk 0 text. Clicking that row opens the preview on the pages that hold chunk 0, to the right of results.

## Backend

Documents belong to a session. Chunks belong to a document. Embeddings belong to a chunk. Deleting a document deletes its chunks and those chunks' embeddings. There is no separate delete for a chunk or an embedding.

### Status

`documents.status` moves in this order:

1. `processing` — the library in `sessions.preferences.pdf_library` is extracting the PDF. `pymupdf` is PyMuPDF. `pyplumber` is PyPlumber.
2. `processed` — extraction finished.
3. `chunking` — chunks are being built.
4. `chunked` — chunks are stored.
5. `embedding` — embeddings are being written.
6. `ready` — every chunk has an embedding. Query is allowed.

The processing step uses the library stored in `sessions.preferences.pdf_library` for every document. The embedding step uses the model id stored in `sessions.preferences.embedding_model_id` for every document. Upload starts this pipeline on its own. The user does not run extract, chunk, and embed as three manual steps. The Action column shows Chunk only at `processed`, so a document that finished extraction and has no chunks can open the create-chunks panel from that button. Chunking starts when that panel is confirmed. It shows Query only at `ready`.

### Retrieval

| Mode | What runs |
|---|---|
| naive | Semantic search over the document's embeddings |
| hybrid | BM25 plus semantic search. The Score column shows the keyword score, the dense score, and the RRF score. Ranking and the threshold use RRF |

Top-K limits the returned rows. The score threshold drops hits under that score.
