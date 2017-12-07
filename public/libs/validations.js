$(function(){
  $.validator.addMethod('strongPassword', function(value, element){
    return value.length >= 8;
  }, 'Your password must be at least 8 characters long.');
  $("#mainForm").validate({
    rules: {
      email: {
        required: true,
        email: true
      },
      password: {
        require: true,
        strongPassword: true
      },
      name: {
        required: true,
        nowhitespace: true

      }
    },
    messages: {
      email: {
        required: 'Please enter an email address.',
        email: 'Please enter a valid email address.'       
      }
    }
  })
});