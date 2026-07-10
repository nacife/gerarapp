import { Controller, Get, Param, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Roles } from '../common/decorators';
import { prisma } from '@eduforge/db';

@Controller('admin/scorm')
export class ScormController {
  @Get('export/:projectId')
  @Roles('admin', 'super_admin')
  async exportScorm(@Param('projectId') projectId: string, @Res() res: FastifyReply) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, title: true, slug: true } });
    if (!project) return res.status(404).send({ error: 'not found' });

    // SCORM 1.2 manifest XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="eduforge_${project.id}" version="1.2"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <organizations default="org1">
    <organization identifier="org1">
      <title>${project.title}</title>
      <item identifier="item1" identifierref="res1">
        <title>${project.title}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res1" type="webcontent" adlcp:scormType="sco" href="${process.env.RUNTIME_BASE_URL ?? 'http://localhost:5173'}/${project.slug}">
      <file href="${project.slug}"/>
    </resource>
  </resources>
</manifest>`;

    res.header('Content-Type', 'application/xml');
    res.header('Content-Disposition', `attachment; filename="${project.slug}_scorm12.zip"`);
    return res.send(xml);
  }
}
