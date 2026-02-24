package tr.org.lider.repositories;

import java.util.List;

import javax.transaction.Transactional;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import tr.org.lider.entities.PolicyExceptionImpl;
import tr.org.lider.entities.PolicyImpl;

public interface PolicyExceptionRepository extends BaseJpaRepository<PolicyExceptionImpl, Long>{
	List<PolicyExceptionImpl> findByDn(String dn);
	List<PolicyExceptionImpl> findAllByDeleted(Boolean deleted);
	
	@Query("SELECT pe FROM PolicyExceptionImpl pe LEFT JOIN pe.policy p WHERE p.id = ?1")
	List<PolicyExceptionImpl> findByPolicy(Long id);
	
	List<PolicyExceptionImpl> findByPolicyAndDn(PolicyImpl policy, String dn);
	
	List<PolicyExceptionImpl> findByPolicyAndGroupDn(PolicyImpl policy, String dn);

	@Transactional
	@Modifying(clearAutomatically = true)
	void deleteByPolicy(PolicyImpl policy);
	
}
