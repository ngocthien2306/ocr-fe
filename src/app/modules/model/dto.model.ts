export class MockModel {
    id: number;
    name: string;
    age: number;
    grade: string;
  
    constructor(id: number, name: string, age: number, grade: string) {
      this.id = id;
      this.name = name;
      this.age = age;
      this.grade = grade;
    }
  }

export class OCRResult {
  base64_image: string;
  rpm: string;
  oilt: string
}