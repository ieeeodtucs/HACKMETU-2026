package tr.org.lider.controllers;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import tr.org.lider.services.AuthenticationService;

@RestController
@RequestMapping("/test")
public class TestController {

	@RequestMapping(value = "/hello", method=RequestMethod.GET)
	public String testRequest() {
		return "Hello World!!!";
	}
	
	
	@RequestMapping(value = "/secured", method=RequestMethod.POST)
	public String restRequestSecured(Authentication authentication) {
		return "Hello World Secured service called by: " + AuthenticationService.getUserName();
	}
}
