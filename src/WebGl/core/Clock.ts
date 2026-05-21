import { clamp } from '../../utils/maths';

export class Clock {
  public time: number = 0;
  public elapsed: number = 0;
  public delta: number = 0; // in seconds

  public update(): void {
    this.delta = clamp(-this.time + (this.time = Date.now()), 1, 17) / 1000;
    this.elapsed += this.delta;
  }

  public start(): void {
    this.time = Date.now();
    this.delta = 0;
  }
}
