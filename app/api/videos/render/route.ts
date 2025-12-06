import { getDb } from "@/lib/mongodb"
import { uploadFile } from "@/lib/oracle-storage"
import { buildCaptionFile } from "@/lib/captions"
import { getCurrentUser } from "@/lib/auth"
import {
  STORAGE_PREFIX,
  captionRequestSchema,
  assertEnv,
  RENDER_RESOLUTIONS,
  type CaptionSegment
} from "@/lib/pipeline"

import jwt from "jsonwebtoken"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { ObjectId } from "mongodb"

export async function POST(request: NextRequest) {
  const db = await getDb()
  
  const user = await getCurrentUser()
  const userId = user?.userId || "default-user"

  try {
    const body = captionRequestSchema.parse(await request.json())

    // Fetch upload row
    let upload
    try {
      upload = await db.collection("uploads").findOne({
        _id: new ObjectId(body.uploadId),
        user_id: userId,
      })
    } catch (error) {
      return NextResponse.json({ error: "Invalid upload ID format" }, { status: 400 })
    }

    if (!upload) {
      console.log(`[Render] Upload not found. ID: ${body.uploadId}, User: ${userId}`)
      return NextResponse.json({ error: "Upload not found" }, { status: 404 })
    }

    // Build caption segments
    let captionSource
    try {
      captionSource = await resolveCaptionSource(db, upload._id.toString(), userId, body)
    } catch (lookupError) {
      return NextResponse.json({ error: (lookupError as Error).message }, { status: 404 })
    }

    const resolutionConfig = RENDER_RESOLUTIONS[body.resolution] || RENDER_RESOLUTIONS["1080p"]
    const finalCustomStyles = {
      ...body.customStyles,
      playResX: body.customStyles?.playResX ?? resolutionConfig.width,
      playResY: body.customStyles?.playResY ?? resolutionConfig.height,
    }

    const captionFile = buildCaptionFile(body.template, captionSource.segments, finalCustomStyles)
    const captionBuffer = Buffer.from(captionFile.content, "utf-8")

    // Extended Emoji Trigger System
    const EMOJI_MAP: Record<string, string> = {
      // Money / Wealth
      "money": "https://raw.githubusercontent.com/notankith/cloudinarytest/refs/heads/main/Money.gif",
      "cash": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f4b5.png",
      "rich": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f4b8.png",
      "wealth": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f4b8.png",
      "profit": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f4c8.png",
      "growth": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f4c8.png",
      "upgrade": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f680.png",
      "boss": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f4aa.png",
      
      // Winning / Energy
      "win": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f3c6.png",
      "victory": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f3c6.png",
      "hype": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f525.png",
      "fire": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f525.png",
      "lit": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f525.png",
      "trending": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f525.png",
      "wow": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f929.png",
      "awesome": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f929.png",
      "shocked": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f631.png",
      "speed": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f4ab.png",
      "fast": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f4ab.png",
      "rocket": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f680.png",

      // Danger / Chaos
      "danger": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/26a0.png",
      "warning": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/26a0.png",
      "caution": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/26a0.png",
      "boom": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f4a5.png",
      "explosion": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f4a5.png",
      "dead": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/2620.png",
      "skull": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/2620.png",
      "crazy": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f92f.png",

      // Emotions
      "love": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/2764.png",
      "heart": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/2764.png",
      "broken": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f494.png",
      "sad": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f622.png",
      "cry": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f622.png",
      "surprise": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f632.png",
      "fear": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f631.png",
      "smile": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f642.png",
      "happy": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f642.png",
      "angry": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f620.png",

      // Magic / Fun
      "star": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/2b50.png",
      "sparkle": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/2728.png",
      "magic": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/2728.png",
      "party": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f389.png",
      "celebrate": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f389.png",
      "king": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f451.png",
      "queen": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f451.png",
      "gift": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f381.png",
      "blast": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f4a3.png",

      // Brain / Logic
      "idea": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f4a1.png",
      "light": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f4a1.png",
      "brain": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f9e0.png",
      "smart": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f9e0.png",
      "thinking": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f914.png",
      "question": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/2753.png",
      "check": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/2705.png",

      // Misc
      "break": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f6a8.png",
      "alert": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f6a8.png",
      "flex": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f4aa.png",
      "freeze": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/2744.png",
      "heat": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f525.png",
      "thumbs-up": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f44d.png"
    };

    let overlays: import("@/lib/pipeline").RenderOverlay[] = [];
    
    // Scan segments for trigger words
    captionSource.segments.forEach((segment) => {
      const words = segment.text.toLowerCase().split(/\s+/);
      words.forEach((word) => {
        // Clean punctuation
        const cleanWord = word.replace(/[^a-z0-9]/g, "");
        if (EMOJI_MAP[cleanWord]) {
          overlays.push({
            url: EMOJI_MAP[cleanWord],
            start: segment.start,
            end: segment.end,
            x: 0, // Will be handled by ffmpeg worker
            width: 100 // Standard size for emojis
          });
        }
      });
    });

    console.log(`[API] Generated ${overlays.length} emoji overlays`);

    const basePayload = {
      template: body.template,
      resolution: body.resolution,
      transcriptId: captionSource.transcriptId,
      translationId: captionSource.translationId,
      videoPath: upload.storage_path,
      captionPath: "",
      segmentsProvided: Boolean(body.segments?.length),
      segmentCount: captionSource.segments.length,
      overlays: overlays,
    }

    // Create job
    const jobResult = await db.collection("jobs").insertOne({
      upload_id: upload._id.toString(),
      user_id: userId,
      type: "render",
      payload: basePayload,
      status: "queued",
      created_at: new Date(),
    })

    const jobId = jobResult.insertedId.toString()

    // Upload caption file
    const captionPath = `${STORAGE_PREFIX.captions}/${upload.user_id}/${upload._id.toString()}/${jobId}.${captionFile.format}`

    await db.collection("jobs").updateOne(
      { _id: jobResult.insertedId },
      { $set: { payload: { ...basePayload, captionPath } } }
    )

    try {
      await uploadFile(
        captionPath,
        captionBuffer,
        captionFile.format === "srt" ? "text/plain" : "text/x-ass"
      )
    } catch (captionUploadError) {
      console.error("Unable to upload caption file", captionUploadError)
      await db.collection("jobs").updateOne(
        { _id: jobResult.insertedId },
        { $set: { status: "failed" } }
      )
      return NextResponse.json({ error: "Failed to store caption file" }, { status: 500 })
    }

    // Update upload status
    await db.collection("uploads").updateOne(
      { _id: upload._id },
      {
        $set: {
          status: "rendering",
          caption_asset_path: captionPath,
          updated_at: new Date(),
        }
      }
    )

    // Worker vars
    const workerUrl = assertEnv("FFMPEG_WORKER_URL", process.env.FFMPEG_WORKER_URL)
    const workerSecret = assertEnv("WORKER_JWT_SECRET", process.env.WORKER_JWT_SECRET)

    const token = jwt.sign({ jobId, uploadId: upload._id.toString() }, workerSecret, {
      expiresIn: "10m",
    })

    // overlays already computed above

    const renderPayload = {
      jobId,
      uploadId: upload._id.toString(),
      videoPath: upload.storage_path,
      captionPath,
      captionFormat: captionFile.format,
      template: body.template,
      resolution: body.resolution,
      outputPath: `${STORAGE_PREFIX.renders}/${upload.user_id}/${jobId}/rendered.mp4`,
      overlays,
    }

    // Send to worker (IMPORTANT: /render route restored)
    const workerResponse = await fetch(`${workerUrl}/render`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(renderPayload),
    })

    if (!workerResponse.ok) {
      const reason = await workerResponse.text()
      console.error("Worker rejected render job", reason)

      await db.collection("jobs").updateOne(
        { _id: jobResult.insertedId },
        {
          $set: {
            status: "failed",
            error: "Worker rejected job",
          }
        }
      )

      return NextResponse.json({ error: "Worker rejected job" }, { status: 502 })
    }

    return NextResponse.json({
      jobId,
      uploadId: upload._id.toString(),
      captionPath,
      videoPath: upload.storage_path,
      outputPath: `${STORAGE_PREFIX.renders}/${upload.user_id}/${jobId}/rendered.mp4`,
      status: "queued",
    })
  } catch (error) {
    console.error("Render enqueue error", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to enqueue render" }, { status: 500 })
  }
}

// fetch transcript/translation
async function resolveCaptionSource(
  db: Awaited<ReturnType<typeof getDb>>,
  uploadId: string,
  userId: string,
  body: z.infer<typeof captionRequestSchema>,
) {

  if (body.segments?.length) {
    // If karaoke template, normalize segments for per-word timings
    if (body.template === "karaoke") {
      const normalizedSegments = body.segments.map((segment) => {
        // Always rebuild words array from text, ignore any provided words
        const tokens = segment.text?.split(/\s+/) ?? [];
        const duration = Math.max(0, Number(segment.end) - Number(segment.start));
        const perToken = tokens.length ? duration / tokens.length : 0.2;
        const words = tokens.map((token, i) => ({
          text: token,
          start: Number(segment.start) + perToken * i,
          end: Number(segment.start) + perToken * (i + 1)
        }));
        return { ...segment, words };
      });
      return {
        transcriptId: body.transcriptId ?? null,
        translationId: body.translationId ?? null,
        segments: sanitizeClientSegments(normalizedSegments),
      };
    }
    // Otherwise, normal segment handling
    return {
      transcriptId: body.transcriptId ?? null,
      translationId: body.translationId ?? null,
      segments: sanitizeClientSegments(body.segments),
    };
  }

  if (body.translationId) {
    let translation
    try {
      translation = await db.collection("translations").findOne({
        _id: new ObjectId(body.translationId),
        user_id: userId,
      })
    } catch (error) {
      throw new Error("Invalid translation ID format")
    }

    if (!translation) throw new Error("Translation not found")

    // Verify translation belongs to correct upload
    const transcript = await db.collection("transcripts").findOne({
      _id: new ObjectId(translation.transcript_id),
      upload_id: uploadId,
    })

    if (!transcript) throw new Error("Translation not found for this upload")

    return {
      transcriptId: translation.transcript_id,
      translationId: translation._id.toString(),
      segments: translation.segments as CaptionSegment[],
    }
  }

  const transcriptId = body.transcriptId ?? null
  let transcript

  if (transcriptId) {
    try {
      transcript = await db.collection("transcripts").findOne({
        _id: new ObjectId(transcriptId),
        user_id: userId,
      })
    } catch (error) {
      throw new Error("Invalid transcript ID format")
    }
  } else {
    transcript = await db.collection("transcripts")
      .find({ upload_id: uploadId, user_id: userId })
      .sort({ created_at: -1 })
      .limit(1)
      .next()
  }

  if (!transcript) throw new Error("Transcript not found")

  return {
    transcriptId: transcript._id.toString(),
    translationId: null,
    segments: transcript.segments as CaptionSegment[],
  }
}

function sanitizeClientSegments(rawSegments: NonNullable<z.infer<typeof captionRequestSchema>["segments"]>): CaptionSegment[] {
  return rawSegments.map((segment, index) => {
    const fallbackStart = index * 2
    const start = Number.isFinite(segment.start) ? Number(segment.start) : fallbackStart
    const minEnd = start + 0.2
    const endCandidate = Number.isFinite(segment.end) ? Number(segment.end) : minEnd
    const end = endCandidate > start ? endCandidate : minEnd
    const text = segment.text?.trim() ?? ""
    const words = segment.words?.map((word, wordIndex) => {
      const wordStart = Number.isFinite(word.start) ? Number(word.start) : start + wordIndex * 0.2
      const wordEndCandidate = Number.isFinite(word.end) ? Number(word.end) : wordStart + 0.2
      const wordEnd = wordEndCandidate > wordStart ? wordEndCandidate : wordStart + 0.2
      return {
        start: wordStart,
        end: wordEnd,
        text: word.text?.trim() ?? "",
      }
    })

    return {
      id: segment.id ? String(segment.id) : `segment_${index}`,
      start,
      end,
      text,
      words,
    }
  })
}
