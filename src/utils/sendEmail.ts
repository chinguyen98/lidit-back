import nodemailer from 'nodemailer';

export const sendEmail = async (to: string, text: string) => {
  // let testAccount = await nodemailer.createTestAccount();
  // console.log('testAccount', testAccount);

  let user = 'dh5guuaxv3krwawl@ethereal.email';
  let pass = 'gZdVHmsazSJ1FtkMtV';

  // create reusable transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user, // generated ethereal user
      pass, // generated ethereal password
    },
  });

  // send mail with defined transport object
  let info = await transporter.sendMail({
    from: '"Fred Foo 👻" <foo@example.com>', // sender address
    to, // list of receivers
    subject: 'Change password', // Subject line
    text, // plain text body
  });

  console.log('Message sent: %s', info.messageId);
  console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
};
