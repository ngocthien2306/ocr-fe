import {AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild, HostListener} from '@angular/core';
import {WebcamInitError} from '../domain/webcam-init-error';
import {WebcamImage} from '../domain/webcam-image';
import {Observable, Subscription} from 'rxjs';
import {WebcamUtil} from '../util/webcam.util';
import {WebcamMirrorProperties} from '../domain/webcam-mirror-properties';

@Component({
  selector: 'webcam',
  templateUrl: './webcam.component.html',
  styleUrls: ['./webcam.component.scss']
})
export class WebcamComponent implements AfterViewInit, OnDestroy {
  private static DEFAULT_VIDEO_OPTIONS: MediaTrackConstraints = {facingMode: 'environment'};
  private static DEFAULT_IMAGE_TYPE: string = 'image/jpeg';
  private static DEFAULT_IMAGE_QUALITY: number = 1;

  /** Defines the max width of the webcam area in px */
  @Input() public width: number = 338;
  /** Defines the max height of the webcam area in px */
  @Input() public height: number = 450;
  /** Defines base constraints to apply when requesting video track from UserMedia */
  @Input() public videoOptions: MediaTrackConstraints = WebcamComponent.DEFAULT_VIDEO_OPTIONS;
  /** Flag to enable/disable camera switch. If enabled, a switch icon will be displayed if multiple cameras were found */
  @Input() public allowCameraSwitch: boolean = true;
  /** Parameter to control image mirroring (i.e. for user-facing camera). ["auto", "always", "never"] */
  @Input() public mirrorImage: string | WebcamMirrorProperties;
  /** Flag to control whether an ImageData object is stored into the WebcamImage object. */
  @Input() public captureImageData: boolean = false;
  /** The image type to use when capturing snapshots */
  @Input() public imageType: string = WebcamComponent.DEFAULT_IMAGE_TYPE;
  /** The image quality to use when capturing snapshots (number between 0 and 1) */
  @Input() public imageQuality: number = WebcamComponent.DEFAULT_IMAGE_QUALITY;

  /** EventEmitter which fires when an image has been captured */
  @Output() public imageCapture: EventEmitter<WebcamImage> = new EventEmitter<WebcamImage>();
  /** Emits a mediaError if webcam cannot be initialized (e.g. missing user permissions) */
  @Output() public initError: EventEmitter<WebcamInitError> = new EventEmitter<WebcamInitError>();
  /** Emits when the webcam video was clicked */
  @Output() public imageClick: EventEmitter<void> = new EventEmitter<void>();
  /** Emits the active deviceId after the active video device was switched */
  @Output() public cameraSwitched: EventEmitter<string> = new EventEmitter<string>();

  /** available video devices */
  public availableVideoInputs: MediaDeviceInfo[] = [];

  /** Indicates whether the video device is ready to be switched */
  public videoInitialized: boolean = false;

  /** If the Observable represented by this subscription emits, an image will be captured and emitted through
   * the 'imageCapture' EventEmitter */
  private triggerSubscription: Subscription;
  /** Index of active video in availableVideoInputs */
  private activeVideoInputIndex: number = -1;
  /** Subscription to switchCamera events */
  private switchCameraSubscription: Subscription;
  /** MediaStream object in use for streaming UserMedia data */
  private mediaStream: MediaStream = null;

  @ViewChild('video', { static: true }) private video: ElementRef<HTMLVideoElement>;
  /** Canvas for Video Snapshots */
  @ViewChild('canvas', { static: true }) private canvas: ElementRef<HTMLCanvasElement>;
  
  @ViewChild('canvasimage', { static: true }) private canvasimage: ElementRef<HTMLCanvasElement>;

  /** width and height of the active video stream */
  private activeVideoSettings: MediaTrackSettings = null;
  private ctx: CanvasRenderingContext2D;
  private isDrawing = false;
  private isDragging = false;
  private isResizing = false;
  private startX = 0;
  private startY = 0;
  private rect = { x: 0, y: 0, width: 0, height: 0 };
  private offsetX = 0;
  private offsetY = 0;
  private resizeHandleSize = 10;
  private currentHandle: string = '';

  public ngAfterViewInit(): void {
    this.ctx = this.canvas.nativeElement.getContext('2d');

    debugger;
    const x = this.width / 5;
    const y = this.height / 5;
    const rectWidth = this.width * (3 / 5);
    const rectHeight = this.height * (3 / 5);

    this.rect.x = x;
    this.rect.y = y;
    this.rect.width = rectWidth;
    this.rect.height = rectHeight;



    this.detectAvailableDevices()
      .then(() => {
        // start video
        this.switchToVideoInput(null);
      })
      .catch((err: string) => {
        this.initError.next(<WebcamInitError>{message: err});
        // fallback: still try to load webcam, even if device enumeration failed
        this.switchToVideoInput(null);
      });

    this.video.nativeElement.addEventListener('loadedmetadata', () => {
      this.setCanvasDimensions();
      // this.drawRectangleOnCanvas();
      this.draw();

    });

  }

  public ngOnDestroy(): void {
    this.stopMediaTracks();
    this.unsubscribeFromSubscriptions();
  }

  
  handleMouseDown(event: MouseEvent | TouchEvent) {
    event.preventDefault();
    const pos = this.getPosition(event);
    const handle = this.getResizeHandle(pos);

    if (handle) {
      this.isResizing = true;
      this.currentHandle = handle;
    } else if (this.isPointInRect(pos)) {
      this.isDragging = true;
      this.offsetX = pos.x - this.rect.x;
      this.offsetY = pos.y - this.rect.y;
    } else {
      this.isDrawing = true;
      this.startX = pos.x;
      this.startY = pos.y;
    }
  }

  handleMouseMove(event: MouseEvent | TouchEvent) {
    event.preventDefault();
    const pos = this.getPosition(event);

    if (this.isDrawing) {
      const width = pos.x - this.startX;
      const height = pos.y - this.startY;
      this.rect = { x: this.startX, y: this.startY, width: width, height: height };
      this.draw();
    } else if (this.isDragging) {
      this.rect.x = pos.x - this.offsetX;
      this.rect.y = pos.y - this.offsetY;
      this.draw();
    } else if (this.isResizing) {
      this.resizeRectangle(pos);
      this.draw();
    }
  }

  handleMouseUp() {
    this.isDrawing = false;
    this.isDragging = false;
    this.isResizing = false;
    this.currentHandle = '';
  }

  private getPosition(event: MouseEvent | TouchEvent): { x: number, y: number } {
    const rect = this.canvas.nativeElement.getBoundingClientRect();
    if (event instanceof MouseEvent) {
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    } else {
      const touch = event.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    }
  }

  private isPointInRect(pos: { x: number, y: number }): boolean {
    return pos.x > this.rect.x && pos.x < this.rect.x + this.rect.width &&
           pos.y > this.rect.y && pos.y < this.rect.y + this.rect.height;
  }

  private getResizeHandle(pos: { x: number, y: number }): string | null {
    const handles = [
      { x: this.rect.x, y: this.rect.y, handle: 'top-left' },
      { x: this.rect.x + this.rect.width, y: this.rect.y, handle: 'top-right' },
      { x: this.rect.x, y: this.rect.y + this.rect.height, handle: 'bottom-left' },
      { x: this.rect.x + this.rect.width, y: this.rect.y + this.rect.height, handle: 'bottom-right' }
    ];

    for (const h of handles) {
      if (pos.x >= h.x - this.resizeHandleSize && pos.x <= h.x + this.resizeHandleSize &&
          pos.y >= h.y - this.resizeHandleSize && pos.y <= h.y + this.resizeHandleSize) {
        return h.handle;
      }
    }

    return null;
  }

  private resizeRectangle(pos: { x: number, y: number }) {
    switch (this.currentHandle) {
      case 'top-left':
        this.rect.width += this.rect.x - pos.x;
        this.rect.height += this.rect.y - pos.y;
        this.rect.x = pos.x;
        this.rect.y = pos.y;
        break;
      case 'top-right':
        this.rect.width = pos.x - this.rect.x;
        this.rect.height += this.rect.y - pos.y;
        this.rect.y = pos.y;
        break;
      case 'bottom-left':
        this.rect.width += this.rect.x - pos.x;
        this.rect.height = pos.y - this.rect.y;
        this.rect.x = pos.x;
        break;
      case 'bottom-right':
        this.rect.width = pos.x - this.rect.x;
        this.rect.height = pos.y - this.rect.y;
        break;
    }
  }

  private draw() {
    this.ctx.strokeStyle = 'red';
    this.ctx.lineWidth = 3;
  
    this.ctx.clearRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
    this.ctx.beginPath();
    this.ctx.rect(this.rect.x, this.rect.y, this.rect.width, this.rect.height);
    this.ctx.stroke();
    this.drawResizeHandles();
  }

  private drawResizeHandles() {
    const handles = [
      { x: this.rect.x, y: this.rect.y },
      { x: this.rect.x + this.rect.width, y: this.rect.y },
      { x: this.rect.x, y: this.rect.y + this.rect.height },
      { x: this.rect.x + this.rect.width, y: this.rect.y + this.rect.height }
    ];

    this.ctx.fillStyle = 'white';
    for (const h of handles) {
      this.ctx.fillRect(h.x - this.resizeHandleSize / 2, h.y - this.resizeHandleSize / 2, this.resizeHandleSize, this.resizeHandleSize);
    }
  }

  @HostListener('window:resize')
  onWindowResize() {
    //this.setCanvasDimensions();
    //this.drawRectangleOnCanvas();
  }

  setCanvasDimensions() {
    const video = this.video.nativeElement;
    const canvas = this.canvas.nativeElement;

    canvas.width = 338;
    canvas.height = 450;
  }

  drawRectangleOnCanvas() {
    const canvas = this.canvas.nativeElement;
    const context = canvas.getContext('2d');

    if (context) {
      const rectWidth = 240;
      const rectHeight = 320;
      

      // Calculate the top-left coordinates to center the rectangle
      const x = (canvas.width - rectWidth) / 2;
      const y = (canvas.height - rectHeight) / 2;

      context.clearRect(0, 0, canvas.width, canvas.height); 
      context.strokeStyle = 'red'; 
      context.lineWidth = 5;
      context.strokeRect(x, y, rectWidth, rectHeight); // Draw the rectangle (x, y, width, height)

    }
  }
  /**
   * If the given Observable emits, an image will be captured and emitted through 'imageCapture' EventEmitter
   */
  @Input()
  public set trigger(trigger: Observable<void>) {
    if (this.triggerSubscription) {
      this.triggerSubscription.unsubscribe();
    }

    // Subscribe to events from this Observable to take snapshots
    this.triggerSubscription = trigger.subscribe(() => {
      this.takeSnapshot();
    });
  }

  /**
   * If the given Observable emits, the active webcam will be switched to the one indicated by the emitted value.
   * @param switchCamera Indicates which webcam to switch to
   *   true: cycle forwards through available webcams
   *   false: cycle backwards through available webcams
   *   string: activate the webcam with the given id
   */
  @Input()
  public set switchCamera(switchCamera: Observable<boolean | string>) {
    if (this.switchCameraSubscription) {
      this.switchCameraSubscription.unsubscribe();
    }

    // Subscribe to events from this Observable to switch video device
    this.switchCameraSubscription = switchCamera.subscribe((value: boolean | string) => {
      if (typeof value === 'string') {
        // deviceId was specified
        this.switchToVideoInput(value);
      } else {
        // direction was specified
        this.rotateVideoInput(value !== false);
      }
    });
  }

  /**
   * Get MediaTrackConstraints to request streaming the given device
   * @param deviceId
   * @param baseMediaTrackConstraints base constraints to merge deviceId-constraint into
   * @returns
   */
  private static getMediaConstraintsForDevice(deviceId: string, baseMediaTrackConstraints: MediaTrackConstraints): MediaTrackConstraints {
    const result: MediaTrackConstraints = baseMediaTrackConstraints ? baseMediaTrackConstraints : this.DEFAULT_VIDEO_OPTIONS;
    if (deviceId) {
      result.deviceId = {exact: deviceId};
    }

    return result;
  }

  /**
   * Tries to harvest the deviceId from the given mediaStreamTrack object.
   * Browsers populate this object differently; this method tries some different approaches
   * to read the id.
   * @param mediaStreamTrack
   * @returns deviceId if found in the mediaStreamTrack
   */
  private static getDeviceIdFromMediaStreamTrack(mediaStreamTrack: MediaStreamTrack): string {
    if (mediaStreamTrack.getSettings && mediaStreamTrack.getSettings() && mediaStreamTrack.getSettings().deviceId) {
      return mediaStreamTrack.getSettings().deviceId;
    } else if (mediaStreamTrack.getConstraints && mediaStreamTrack.getConstraints() && mediaStreamTrack.getConstraints().deviceId) {
      const deviceIdObj: ConstrainDOMString = mediaStreamTrack.getConstraints().deviceId;
      return WebcamComponent.getValueFromConstrainDOMString(deviceIdObj);
    }
  }

  /**
   * Tries to harvest the facingMode from the given mediaStreamTrack object.
   * Browsers populate this object differently; this method tries some different approaches
   * to read the value.
   * @param mediaStreamTrack
   * @returns facingMode if found in the mediaStreamTrack
   */
  private static getFacingModeFromMediaStreamTrack(mediaStreamTrack: MediaStreamTrack): string {
    if (mediaStreamTrack) {
      if (mediaStreamTrack.getSettings && mediaStreamTrack.getSettings() && mediaStreamTrack.getSettings().facingMode) {
        return mediaStreamTrack.getSettings().facingMode;
      } else if (mediaStreamTrack.getConstraints && mediaStreamTrack.getConstraints() && mediaStreamTrack.getConstraints().facingMode) {
        const facingModeConstraint: ConstrainDOMString = mediaStreamTrack.getConstraints().facingMode;
        return WebcamComponent.getValueFromConstrainDOMString(facingModeConstraint);
      }
    }
  }

  /**
   * Determines whether the given mediaStreamTrack claims itself as user facing
   * @param mediaStreamTrack
   */
  private static isUserFacing(mediaStreamTrack: MediaStreamTrack): boolean {
    const facingMode: string = WebcamComponent.getFacingModeFromMediaStreamTrack(mediaStreamTrack);
    return facingMode ? 'user' === facingMode.toLowerCase() : false;
  }

  /**
   * Extracts the value from the given ConstrainDOMString
   * @param constrainDOMString
   */
  private static getValueFromConstrainDOMString(constrainDOMString: ConstrainDOMString): string {
    if (constrainDOMString) {
      if (constrainDOMString instanceof String) {
        return String(constrainDOMString);
      } else if (Array.isArray(constrainDOMString) && Array(constrainDOMString).length > 0) {
        return String(constrainDOMString[0]);
      } else if (typeof constrainDOMString === 'object') {
        if (constrainDOMString['exact']) {
          return String(constrainDOMString['exact']);
        } else if (constrainDOMString['ideal']) {
          return String(constrainDOMString['ideal']);
        }
      }
    }

    return null;
  }



  /**
   * Takes a snapshot of the current webcam's view and emits the image as an event
   */
  public takeSnapshot(): void {
    // set canvas size to actual video size
    const _video = this.nativeVideoElement;
    const dimensions = {width: this.width, height: this.height};
    if (_video.videoWidth) {
      dimensions.width = _video.videoWidth;
      dimensions.height = _video.videoHeight;
    }

    const _canvas = this.canvasimage.nativeElement;
    _canvas.width = dimensions.width;
    _canvas.height = dimensions.height;

    // paint snapshot image to canvas
    const context2d = _canvas.getContext('2d');
    context2d.drawImage(_video, 0, 0);

    // read canvas content as image
    const mimeType: string = this.imageType ? this.imageType : WebcamComponent.DEFAULT_IMAGE_TYPE;
    const quality: number = this.imageQuality ? this.imageQuality : WebcamComponent.DEFAULT_IMAGE_QUALITY;
    const dataUrl: string = _canvas.toDataURL(mimeType, quality);

    // get the ImageData object from the canvas' context.
    let imageData: ImageData = null;
    
    if (this.captureImageData) {
      imageData = context2d.getImageData(0, 0, _canvas.width, _canvas.height);
    }



    const rectWidth = this.rect.width;
    const rectHeight = this.rect.height;
    const maxWidth = 338;
    const maxHeight = 450;

    const x1 = (this.rect.x);
    const y1 = (this.rect.y);


    const x2 = x1 + rectWidth;
    const y2 = y1 + rectHeight;

    const normalizedX1 = x1 / maxWidth;
    const normalizedY1 = y1 / maxHeight;
    const normalizedX2 = x2 / maxWidth;
    const normalizedY2 = y2 / maxHeight;

    this.imageCapture.next(new WebcamImage(dataUrl, mimeType, imageData, [normalizedX1, normalizedY1], [normalizedX2, normalizedY2]));
  }

  /**
   * Switches to the next/previous video device
   * @param forward
   */
  public rotateVideoInput(forward: boolean) {
    if (this.availableVideoInputs && this.availableVideoInputs.length > 1) {
      const increment: number = forward ? 1 : (this.availableVideoInputs.length - 1);
      const nextInputIndex = (this.activeVideoInputIndex + increment) % this.availableVideoInputs.length;
      this.switchToVideoInput(this.availableVideoInputs[nextInputIndex].deviceId);
    }
  }

  /**
   * Switches the camera-view to the specified video device
   */
  public switchToVideoInput(deviceId: string): void {
    this.videoInitialized = false;
    this.stopMediaTracks();
    this.initWebcam(deviceId, this.videoOptions);
  }


  /**
   * Event-handler for video resize event.
   * Triggers Angular change detection so that new video dimensions get applied
   */
  public videoResize(): void {
    // here to trigger Angular change detection
  }

  public get videoWidth() {
    const videoRatio = this.getVideoAspectRatio();
    return Math.min(this.width, this.height * videoRatio);
  }

  public get videoHeight() {
    const videoRatio = this.getVideoAspectRatio();
    return Math.min(this.height, this.width / videoRatio);
  }

  public get videoStyleClasses() {
    let classes: string = '';

    if (this.isMirrorImage()) {
      classes += 'mirrored ';
    }

    return classes.trim();
  }

  public get nativeVideoElement() {
    return this.video.nativeElement;
  }

  /**
   * Returns the video aspect ratio of the active video stream
   */
  private getVideoAspectRatio(): number {
    // calculate ratio from video element dimensions if present
    const videoElement = this.nativeVideoElement;
    if (videoElement.videoWidth && videoElement.videoWidth > 0 &&
      videoElement.videoHeight && videoElement.videoHeight > 0) {

      return videoElement.videoWidth / videoElement.videoHeight;
    }

    // nothing present - calculate ratio based on width/height params
    return this.width / this.height;
  }

  /**
   * Init webcam live view
   */
  private initWebcam(deviceId: string, userVideoTrackConstraints: MediaTrackConstraints) {
    const _video = this.nativeVideoElement;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {

      // merge deviceId -> userVideoTrackConstraints
      const videoTrackConstraints = WebcamComponent.getMediaConstraintsForDevice(deviceId, userVideoTrackConstraints);

      navigator.mediaDevices.getUserMedia(<MediaStreamConstraints>{video: videoTrackConstraints})
        .then((stream: MediaStream) => {
          this.mediaStream = stream;
          _video.srcObject = stream;
          _video.play();

          this.activeVideoSettings = stream.getVideoTracks()[0].getSettings();
          const activeDeviceId: string = WebcamComponent.getDeviceIdFromMediaStreamTrack(stream.getVideoTracks()[0]);

          this.cameraSwitched.next(activeDeviceId);

          // Initial detect may run before user gave permissions, returning no deviceIds. This prevents later camera switches. (#47)
          // Run detect once again within getUserMedia callback, to make sure this time we have permissions and get deviceIds.
          this.detectAvailableDevices()
            .then(() => {
              this.activeVideoInputIndex = activeDeviceId ? this.availableVideoInputs
                .findIndex((mediaDeviceInfo: MediaDeviceInfo) => mediaDeviceInfo.deviceId === activeDeviceId) : -1;
              this.videoInitialized = true;
            })
            .catch(() => {
              this.activeVideoInputIndex = -1;
              this.videoInitialized = true;
            });
        })
        .catch((err: DOMException) => {
          this.initError.next(<WebcamInitError>{message: err.message, mediaStreamError: err});
        });
    } else {
      this.initError.next(<WebcamInitError>{message: 'Cannot read UserMedia from MediaDevices.'});
    }
  }

  private getActiveVideoTrack(): MediaStreamTrack {
    return this.mediaStream ? this.mediaStream.getVideoTracks()[0] : null;
  }

  private isMirrorImage(): boolean {
    if (!this.getActiveVideoTrack()) {
      return false;
    }

    // check for explicit mirror override parameter
    {
      let mirror: string = 'auto';
      if (this.mirrorImage) {
        if (typeof this.mirrorImage === 'string') {
          mirror = String(this.mirrorImage).toLowerCase();
        } else {
          // WebcamMirrorProperties
          if (this.mirrorImage.x) {
            mirror = this.mirrorImage.x.toLowerCase();
          }
        }
      }

      switch (mirror) {
        case 'always':
          return true;
        case 'never':
          return false;
      }
    }

    // default: enable mirroring if webcam is user facing
    return WebcamComponent.isUserFacing(this.getActiveVideoTrack());
  }

  /**
   * Stops all active media tracks.
   * This prevents the webcam from being indicated as active,
   * even if it is no longer used by this component.
   */
  private stopMediaTracks() {
    if (this.mediaStream && this.mediaStream.getTracks) {
      // pause video to prevent mobile browser freezes
      this.nativeVideoElement.pause();

      // getTracks() returns all media tracks (video+audio)
      this.mediaStream.getTracks()
        .forEach((track: MediaStreamTrack) => track.stop());
    }
  }

  /**
   * Unsubscribe from all open subscriptions
   */
  private unsubscribeFromSubscriptions() {
    if (this.triggerSubscription) {
      this.triggerSubscription.unsubscribe();
    }
    if (this.switchCameraSubscription) {
      this.switchCameraSubscription.unsubscribe();
    }
  }

  /**
   * Reads available input devices
   */
  private detectAvailableDevices(): Promise<MediaDeviceInfo[]> {
    return new Promise((resolve, reject) => {
      WebcamUtil.getAvailableVideoInputs()
        .then((devices: MediaDeviceInfo[]) => {
          this.availableVideoInputs = devices;
          resolve(devices);
        })
        .catch(err => {
          this.availableVideoInputs = [];
          reject(err);
        });
    });
  }

}
