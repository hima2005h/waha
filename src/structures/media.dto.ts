import { ApiProperty } from '@nestjs/swagger';
import { S3MediaData } from '@waha/structures/media.s3.dto';

export class WAMedia {
  @ApiProperty({
    description: 'The URL for the media in the message if any',
    example:
      'http://localhost:3000/api/files/false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA.oga',
  })
  url?: string;

  @ApiProperty({
    description: 'mimetype for the media in the message if any',
    example: 'audio/jpeg',
  })
  mimetype?: string;

  @ApiProperty({
    description: 'The original filename in mediaUrl in the message if any',
    example: 'example.pdf',
  })
  filename?: string;

  @ApiProperty({
    description:
      'S3 attributes for the media in the message ' +
      'if you are using S3 media storage',
  })
  s3?: S3MediaData;

  @ApiProperty({
    description: "Error message if there's an error downloading the media",
    example: null,
  })
  // eslint-disable-next-line @typescript-eslint/ban-types
  error?: object;
}

export class FileDTO {
  @ApiProperty({
    description: 'The URL for the file',
  })
  url?: string;

  @ApiProperty({
    description: 'Base64 content of the file',
    example: null,
  })
  data?: string;
}

export class VoiceFileDTO extends FileDTO {
  @ApiProperty({
    description: 'The URL for the voice file',
    example:
      'https://file-examples.com/storage/fe3e7fc7fe68462a19ac6ae/2017/11/file_example_MP3_2MG.mp3',
  })
  url?: string;
}

export class VideoFileDTO extends FileDTO {
  @ApiProperty({
    description: 'The URL for the video file',
    example:
      'https://file-examples.com/storage/fe3e7fc7fe68462a19ac6ae/2018/04/file_example_AVI_1280_1_5MG.avi',
  })
  url?: string;
}
