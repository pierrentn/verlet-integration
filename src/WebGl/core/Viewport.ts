import { Vector2 } from 'three/webgpu'

export interface ViewportParameters {
	$canvas: Element
	maximumDpr?: number
	resize?: () => void
}

export class Viewport {
	public $canvas: Element
	public size = new Vector2(1, 1)
	public ratio = 1
	public dpr = 1
	public resize: () => void
	public needsUpdate = false
	private resizeObserver?: ResizeObserver

	public constructor({ $canvas, resize }: ViewportParameters) {
		this.$canvas = $canvas
		this.resize = resize || (() => {})
	}

	public update(): void {
		if (!this.needsUpdate) {
			return
		}

		this.needsUpdate = false
		this.resize()
	}

	public start(): void {
		this.stop()

		if (!this.$canvas) {
			return
		}

		this.set(this.$canvas.getBoundingClientRect())

		this.resizeObserver = new ResizeObserver(this.resizeObserverCallback)
		this.resizeObserver.observe(this.$canvas)
	}

	public stop(): void {
		this.resizeObserver?.disconnect()
		this.resizeObserver = undefined
	}

	public dispose(): void {
		this.stop()
	}

	public set(size: { width: number; height: number }, dpr: number = window.devicePixelRatio || 1): void {
		this.size.set(size.width, size.height)
		this.ratio = size.width / size.height
		this.dpr = Math.min(dpr, 2)
		this.needsUpdate = true
	}

	private resizeObserverCallback = ([entry]: ResizeObserverEntry[]) => {
		this.set(entry!.contentRect)
	}
}
